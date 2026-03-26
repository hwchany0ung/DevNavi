from . import backend, frontend, cloud_devops, fullstack, data, ai_ml, security, ios_android, qa

ROLE_REFERENCE_MAP = {
    "backend":      backend.REFERENCE,
    "frontend":     frontend.REFERENCE,
    "cloud_devops": cloud_devops.REFERENCE,
    "fullstack":    fullstack.REFERENCE,
    "data":         data.REFERENCE,
    "ai_ml":        ai_ml.REFERENCE,
    "security":     security.REFERENCE,
    "ios_android":  ios_android.REFERENCE,
    "qa":           qa.REFERENCE,
}

def get_reference(role: str) -> str:
    return ROLE_REFERENCE_MAP.get(role, "")
