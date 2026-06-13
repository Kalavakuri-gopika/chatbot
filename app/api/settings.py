import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.models.user import User

router = APIRouter(prefix="/settings", tags=["System Settings"])
logger = logging.getLogger(__name__)

# In-memory runtime overrides (survive until server restart)
_runtime_overrides: dict = {}


def _get_current_user_dep():
    """Lazy import to avoid circular dependency at module load time."""
    from app.api.auth import get_current_user
    return get_current_user


class ModelConfigRequest(BaseModel):
    huggingface_token: Optional[str] = None
    huggingface_model: Optional[str] = None


class ModelConfigResponse(BaseModel):
    active_model: str
    huggingface_model: str
    huggingface_token_set: bool


@router.get("/model-config", response_model=ModelConfigResponse)
def get_model_config(current_user: User = Depends(_get_current_user_dep())):
    """Returns the current LLM configuration status."""
    from app.core.config import settings
    from app.services.llm import conversational_llm_service

    hf_token = _runtime_overrides.get("HUGGINGFACE_HUB_TOKEN", settings.HUGGINGFACE_HUB_TOKEN)
    hf_model = _runtime_overrides.get("HUGGINGFACE_MODEL", settings.HUGGINGFACE_MODEL)

    active = conversational_llm_service.llm_type or "fallback"

    return ModelConfigResponse(
        active_model=active,
        huggingface_model=hf_model or "",
        huggingface_token_set=bool(hf_token),
    )


@router.post("/model-config")
def update_model_config(
    config: ModelConfigRequest,
    current_user: User = Depends(_get_current_user_dep()),
):
    """
    Updates the HuggingFace token and model at runtime.
    Reinitialises the LLM service so the new model is used immediately.
    """
    from app.services import llm as llm_module
    from app.core.config import settings

    changed = False

    if config.huggingface_token is not None:
        _runtime_overrides["HUGGINGFACE_HUB_TOKEN"] = config.huggingface_token
        os.environ["HUGGINGFACE_HUB_TOKEN"] = config.huggingface_token
        changed = True

    if config.huggingface_model is not None:
        _runtime_overrides["HUGGINGFACE_MODEL"] = config.huggingface_model
        os.environ["HUGGINGFACE_MODEL"] = config.huggingface_model
        changed = True

    if not changed:
        raise HTTPException(status_code=400, detail="No configuration values provided.")

    # Re-read settings from updated env vars and reinitialise the LLM service
    try:
        settings.HUGGINGFACE_HUB_TOKEN = os.environ.get("HUGGINGFACE_HUB_TOKEN", "")
        settings.HUGGINGFACE_MODEL = os.environ.get("HUGGINGFACE_MODEL", "")

        new_service = llm_module.ConversationalLLMService()
        llm_module.conversational_llm_service = new_service
        logger.info(
            f"LLM service re-initialised. Active model type: {new_service.llm_type}"
        )
    except Exception as e:
        logger.error(f"Failed to re-initialise LLM service: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Config saved but LLM service reload failed: {str(e)}",
        )

    return {
        "status": "success",
        "message": "HuggingFace configuration updated and LLM service reloaded.",
        "active_model": llm_module.conversational_llm_service.llm_type or "fallback",
        "huggingface_model": os.environ.get("HUGGINGFACE_MODEL", ""),
        "huggingface_token_set": bool(os.environ.get("HUGGINGFACE_HUB_TOKEN", "")),
    }


@router.post("/model-config/test")
def test_model_connection(current_user: User = Depends(_get_current_user_dep())):
    """Sends a lightweight test prompt to the currently active LLM to verify it is responding."""
    from app.services.llm import conversational_llm_service

    test_prompt = "Reply with exactly: OK"
    try:
        result = conversational_llm_service._call_llm_or_fallback(
            query=test_prompt,
            context="",
            history=[],
        )
        return {
            "status": "success",
            "active_model": conversational_llm_service.llm_type or "fallback",
            "response_preview": result[:200],
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Model test failed: {str(e)}")
