/** Cache successful async initialization while allowing retries after rejection. */
export function retryableInitializer<T>(initialize: () => Promise<T>): () => Promise<T> {
  let value: T | undefined;
  let hasValue = false;
  let pending: Promise<T> | null = null;

  return () => {
    if (hasValue) return Promise.resolve(value as T);
    if (!pending) {
      pending = initialize().then(
        (result) => {
          value = result;
          hasValue = true;
          return result;
        },
        (error) => {
          pending = null;
          throw error;
        },
      );
    }
    return pending;
  };
}
