/** In-app purchases behind an interface so RevenueCat can be dropped in later (Milestone 4). */
export interface Product {
  id: string;
  priceString: string;
  title: string;
}

export interface PurchaseResult {
  success: boolean;
  productId: string;
  cancelled?: boolean;
}

export interface IapService {
  init(): Promise<void>;
  getProducts(ids: string[]): Promise<Product[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  /** Returns product ids of owned non-consumables and active subscriptions. */
  restore(): Promise<string[]>;
}

export class MockIapService implements IapService {
  private owned = new Set<string>();
  async init() {}
  async getProducts(ids: string[]) {
    return ids.map((id) => ({ id, priceString: '$0.99', title: id }));
  }
  async purchase(productId: string) {
    this.owned.add(productId);
    return { success: true, productId };
  }
  async restore() {
    return [...this.owned];
  }
}
