# Diagrama de Sequência — versão original da IA

> **Versão gerada pela IA, sem nenhuma correção.** Guardada aqui para comparação.
> Ferramenta: Claude (Anthropic). O prompt usado está em [`../README.md`](../README.md#prompt-usado).

Operação pedida: **"o restaurante cancela uma doação"**.

```mermaid
sequenceDiagram
    actor R as Restaurante
    participant F as Frontend
    participant A as API
    participant B as Banco de Dados

    R->>F: Clica em "Cancelar doação"
    F->>A: DELETE /api/doacoes/{id}
    A->>B: SELECT status FROM doacoes WHERE id = {id}
    B-->>A: status
    alt status == "disponivel"
        A->>B: DELETE FROM doacoes WHERE id = {id}
        B-->>A: OK
        A-->>F: 200 OK
        F-->>R: "Doação cancelada"
    else status == "reservada"
        A-->>F: 400 Bad Request
        F-->>R: "Não é possível cancelar"
    end
```

Explicação dada pela IA junto com o diagrama:

> O frontend envia uma requisição DELETE para a API. A API consulta o status da doação e,
> se ela ainda estiver disponível, remove o registro do banco. Caso já tenha sido reservada,
> retorna erro 400 informando que o cancelamento não é permitido.
