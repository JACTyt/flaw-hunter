_SCORES = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


def severity_score(severity: str) -> int:
    return _SCORES.get(severity.lower(), 0)
