# Diagrama de Sequência — cancelar doação (versão final)

Responde: **como as partes do sistema colaboram para cancelar uma doação, e o que acontece
quando uma ONG reserva a mesma doação no mesmo instante?** Os participantes são os módulos
reais do repositório.

```mermaid
sequenceDiagram
    autonumber
    actor R as Restaurante
    participant UI as public/js/restaurante.js
    participant Rota as app.js (rota)
    participant Auth as auth.js
    participant Regra as doacoes.js
    participant Repo as repositorio.js
    participant DB as db.js (SQLite)

    R->>UI: clica "Cancelar doação" e confirma
    UI->>Rota: POST /api/doacoes/7/cancelar (Authorization: Bearer token)
    Rota->>Auth: exigirPapel('restaurante')
    Auth->>DB: SELECT usuário pela sessão
    alt sem token ou sessão inválida
        Auth-->>UI: 401 "faça login para continuar"
    else perfil ONG
        Auth-->>UI: 403 "esta ação é exclusiva do perfil restaurante"
    else restaurante logado
        Auth-->>Rota: req.usuario (next)
        Rota->>Regra: cancelar(7, req.usuario)
        Regra->>Repo: buscarPorId(7)
        Repo->>DB: SELECT * FROM doacoes WHERE id = ?
        DB-->>Regra: doação (ou nada)
        alt doação não existe
            Regra--xRota: erroHttp 404 "doação não encontrada"
        else doação de outro restaurante
            Regra--xRota: erroHttp 403 "você só pode cancelar doações publicadas por você"
        else doação encontrada e é dele
            Note over Repo,DB: Uma ONG pode reservar a doação 7 neste intervalo
            Regra->>Repo: cancelar(7, restaurante_id, agoraIso())
            Repo->>DB: UPDATE doacoes SET status='cancelada', cancelada_em=? WHERE id=? AND restaurante_id=? AND status='disponivel' RETURNING *
            alt 1 linha alterada
                DB-->>Regra: doação cancelada
                Regra-->>Rota: doação
                Rota-->>UI: 200 status "cancelada"
                UI-->>R: selo "Cancelada"
            else 0 linhas (já reservada, cancelada ou retirada)
                DB-->>Regra: nada
                Regra--xRota: erroHttp 409 "não é possível cancelar: a doação já está reservada"
            end
        end
        Note over Rota,UI: responderErro() devolve o status do erro e a mensagem, e a tela mostra o aviso e recarrega a lista
    end
```

## Decisões que o diagrama torna visíveis

- **A leitura com `buscarPorId` não autoriza nada.** Ela só escolhe a mensagem de erro. Quem decide
  se o cancelamento acontece é o `UPDATE` condicional (o `UPDATE ... WHERE status = 'disponivel'`), que é atômico no banco.
  Por isso a reserva concorrente nunca gera uma doação cancelada e reservada ao mesmo
  tempo (ADR 0002).
- **Cancelar é um `UPDATE` de status, não um `DELETE`.** O histórico fica no painel do
  restaurante.
- **Duas camadas de autorização:** perfil em `auth.js` (401/403) e dono da doação em
  `doacoes.js` (403).
- **Só `db.js` fala com o SQLite.** Na migração para PostgreSQL (ADR 0001), apenas o último
  participante muda.
