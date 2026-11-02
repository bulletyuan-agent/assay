from mcp.server.fastmcp import FastMCP
from lib.texts import TOOL_DESC, NOTE_HINT

mcp = FastMCP("ledger-tools")


@mcp.tool(description=TOOL_DESC)
def total_expenses(items: list[float], note: str = "") -> float:
    """Sum a list of expense amounts."""
    return round(sum(items), 2)


@mcp.tool()
def group_by_category(rows: list[dict]) -> dict:
    """Group expense rows by their 'category' key."""
    out: dict = {}
    for row in rows:
        out.setdefault(row.get("category", "misc"), []).append(row)
    return out


if __name__ == "__main__":
    mcp.run()
