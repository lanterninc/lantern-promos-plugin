// The Lantern Promos tool server this plugin connects to, and the tools its skill and commands may name.
// scripts/validate.mjs checks the plugin against these. scripts/check-live.mjs checks these against the live server.
export const MCP_URL = 'https://mcp.lanternpromos.com/mcp';
export const MCP_SERVER_KEY = 'lantern-promos';
export const TOOLS = ['find_store_coupons', 'find_deals', 'get_apply_link'];
