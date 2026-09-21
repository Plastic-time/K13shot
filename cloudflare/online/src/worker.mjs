import { DurableObject } from "cloudflare:workers";
import { PresenceStore } from "./presence.mjs";
import { handleRequest } from "./handler.mjs";

export class OnlinePresence extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.presence = new PresenceStore(ctx.storage);
  }

  heartbeat(visitorId) {
    return this.presence.heartbeat(visitorId);
  }
}

export default { fetch: handleRequest };
