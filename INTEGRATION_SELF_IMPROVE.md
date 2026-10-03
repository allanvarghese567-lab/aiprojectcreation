# Self-improving Research Bot engine

BrahmAI / VishvAI / KaalAI use **Research Bot** as their AI engine.  
This feature adds a **self-improving strategy loop** inside that engine.

## Idea

| Piece | Role |
|-------|------|
| Strategy | Rules (holdings, rebalance, point-in-time flag) |
| Data | Universe as of each historical day |
| Table | One panel for the backtest |
| Backtest | Sharpe / return / drawdown |
| Loop | Score → change rule → re-run → write learning |

Survivorship bias example: today’s list vs rebuilding the list every day.

## Setup

1. Apply migration `20261004040000_strategy_self_improve.sql` (or research-bot’s `self_improve_migration.sql` on the same project).
2. Ship `research-bot/worker/self_improve.py` with the worker.
3. Route phrases like `self-improve`, `survivorship`, `backtest loop`, `point-in-time` to the loop and post markdown into `agent_messages` for the active `thread_id`.

## Chat UX

User (via BrahmAI): *“Run the self-improving cheap-ten strategy and show survivorship bias.”*

Reply: markdown report with biased vs point-in-time Sharpe and learned rules.

## CLI demo

```bash
cd research-bot/worker
python self_improve.py 4
```
