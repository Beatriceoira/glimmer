// RevenueCat wrapper. Needs a dev build (not Expo Go); fails soft when the native module is missing.
export function initPurchases(userId: string): boolean {
  try {
    const P = require('react-native-purchases').default;
    P.configure({ apiKey: process.env.EXPO_PUBLIC_RC_KEY || '', appUserID: userId }); // appUserID = our user uuid, used by the webhook
    return true;
  } catch { return false; }
}
export async function buyTurns(productId = 'turns_25') {
  const P = require('react-native-purchases').default;
  const [product] = await P.getProducts([productId]);
  if (!product) throw new Error('Product not available yet');
  await P.purchaseStoreProduct(product); // server grants turns via the RevenueCat webhook
}
