import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  STOCK_DATA_DIR: { static: true },
});
