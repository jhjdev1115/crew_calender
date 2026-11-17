import { Capacitor } from "@capacitor/core";
import { Purchases, type PurchasesPackage } from "@revenuecat/purchases-capacitor";

// RevenueCat 공개 SDK 키. 비밀값이 아니며 앱에 포함된다.
const iosKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? "";

export type ProPackage = PurchasesPackage;

// shortcut: iOS만 연결됨, Android는 Play 결제 상품과 NEXT_PUBLIC_REVENUECAT_ANDROID_KEY를 추가할 때 넓힐 것
export const purchasesAvailable = () =>
  Capacitor.getPlatform() === "ios" && Boolean(iosKey);

let configuredFor: string | null = null;

// 구독을 Firebase 사용자 ID에 묶어야 서버가 같은 ID로 RevenueCat을 조회할 수 있다
async function ready(userId: string) {
  if (configuredFor === userId) return;
  if (configuredFor === null) {
    await Purchases.configure({ apiKey: iosKey, appUserID: userId });
  } else {
    await Purchases.logIn({ appUserID: userId });
  }
  configuredFor = userId;
}

export async function loadProPackages(userId: string): Promise<ProPackage[]> {
  await ready(userId);
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchasePro(userId: string, aPackage: ProPackage) {
  await ready(userId);
  await Purchases.purchasePackage({ aPackage });
}

export async function restorePro(userId: string) {
  await ready(userId);
  await Purchases.restorePurchases();
}
