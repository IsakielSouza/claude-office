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
REMOTE_BASE_RE = re.compile(r"^/[A-Za-z0-9._/-]+$")
COMPOSE_FILE_RE = re.compile(r"^[A-Za-z0-9._-]+\.ya?ml$")

# Mesmos patterns/mensagens dos field_validators de DestinationBody.
_DEST_FIELD_RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
    ("ssh_alias", SSH_ALIAS_RE, "ssh_alias inválido (sem espaços/metacaracteres)"),
    ("remote_base", REMOTE_BASE_RE, "remote_base deve ser caminho absoluto com chars seguros"),
    ("compose_file", COMPOSE_FILE_RE, "compose_file deve ser um arquivo .yml/.yaml"),
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
