"""Validação compartilhada dos campos de destino do Ops.

Fonte única dos patterns usados tanto pelo write-path (DestinationBody em
``app.api.routes.ops``) quanto pelo boundary do runner (``OpsRunner.run``).
Linhas pré-existentes em ``ops_destinations`` (inseridas antes do Pydantic ou
manualmente) NÃO são re-validadas pelo write-path; por isso o runner re-valida
em runtime antes de montar o comando ssh.
"""

import re
from typing import Any

SSH_ALIAS_RE = re.compile(r"^[A-Za-z0-9._@-]+$")
# Rejeita .. e /. explicitamente para prevenir path traversal
REMOTE_BASE_RE = re.compile(r"^/[A-Za-z0-9._/-]+$")
COMPOSE_FILE_RE = re.compile(r"^[A-Za-z0-9._-]+\.ya?ml$")
IMAGE_REGISTRY_RE = re.compile(
    r"^[a-z0-9]([a-z0-9._-]{0,251}[a-z0-9])?(?::[0-9]+)?(?:/[a-z0-9._/-]+)?$"
)
IMAGE_TAG_RE = re.compile(r"^[a-zA-Z0-9._:-]+$")
FRONT_API_URL_RE = re.compile(r"^https?://[A-Za-z0-9._:-]+(?:/[A-Za-z0-9._:/-]*)?/?$")
ID_RE = re.compile(r"^[A-Za-z0-9._-]+$")

# Mesmos patterns/mensagens dos field_validators de DestinationBody.
_DEST_FIELD_RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
    ("ssh_alias", SSH_ALIAS_RE, "ssh_alias inválido (sem espaços/metacaracteres)"),
    ("remote_base", REMOTE_BASE_RE, "remote_base deve ser caminho absoluto com chars seguros"),
    ("compose_file", COMPOSE_FILE_RE, "compose_file deve ser um arquivo .yml/.yaml"),
    ("image_registry", IMAGE_REGISTRY_RE, "image_registry deve ser um registry válido"),
    ("image_tag", IMAGE_TAG_RE, "image_tag deve conter apenas alphanumericos, ., _, :, -"),
    ("front_api_url", FRONT_API_URL_RE, "front_api_url deve ser uma URL http/https válida"),
    ("id", ID_RE, "id deve conter apenas alphanumericos, ., _, -"),
)


class OpsValidationError(ValueError):
    """Campo de destino inválido detectado no boundary do runner."""


def validate_destination_runtime(dest: Any) -> None:
    """Re-valida os campos de destino antes de montar o comando ssh.

    Falha com :class:`OpsValidationError` (mensagem descritiva) se qualquer
    campo for inválido, independente de quando a linha foi inserida no DB.
    """
    for field, pattern, msg in _DEST_FIELD_RULES:
        value = getattr(dest, field, None)
        if not isinstance(value, str) or not pattern.match(value):
            raise OpsValidationError(
                f"destino '{getattr(dest, 'id', '?')}' tem {field} inválido: {value!r} ({msg})"
            )

    # Validações adicionais para remote_base: rejeita .. e /. para prevenir path traversal
    remote_base = getattr(dest, "remote_base", None)
    if isinstance(remote_base, str) and (".." in remote_base or "/." in remote_base):
        raise OpsValidationError(
            f"destino '{getattr(dest, 'id', '?')}' tem remote_base inválido: "
            f"{remote_base!r} (não permitido .. ou /.)"
        )
