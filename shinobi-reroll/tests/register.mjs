// Route the Bedrock script modules to the in-memory mocks when running under Node.
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent(`
    const map = {
      '@minecraft/server': ${JSON.stringify(new URL('./mock/server.js', import.meta.url).href)},
      '@minecraft/server-ui': ${JSON.stringify(new URL('./mock/server-ui.js', import.meta.url).href)},
    };
    export async function resolve(specifier, context, next) {
      if (map[specifier]) return { url: map[specifier], shortCircuit: true };
      return next(specifier, context);
    }
  `)}`,
  import.meta.url,
);
