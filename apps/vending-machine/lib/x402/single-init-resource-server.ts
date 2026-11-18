import { x402ResourceServer } from "@x402/core/server";

/**
 * Route wrappers share one server. Reinitializing it clears its live facilitator
 * maps while /supported is in flight, breaking requests on already-warm routes.
 * Keep initialization single-flight, cache success, and allow a failed attempt
 * to retry. Each HTTP wrapper still runs its own route-configuration validation.
 */
export class SingleInitResourceServer extends x402ResourceServer {
  private initialization: Promise<void> | null = null;

  override initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = super.initialize().catch((error: unknown) => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }
}
