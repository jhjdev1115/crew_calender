import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./firebase-client";

export const isNativeApp = () => Capacitor.isNativePlatform();

const getNativeGoogleCredential = async () => {
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  const accessToken = result.credential?.accessToken;

  if (!idToken && !accessToken) {
    throw new Error("Google 로그인 인증 정보를 받지 못했습니다.");
  }

  return GoogleAuthProvider.credential(idToken ?? null, accessToken ?? null);
};

export const signInWithGoogle = async () => {
  if (!isNativeApp()) {
    return signInWithPopup(firebaseAuth, new GoogleAuthProvider());
  }

  const credential = await getNativeGoogleCredential();
  return signInWithCredential(firebaseAuth, credential);
};

export const reauthenticateWithGoogle = async (user: User) => {
  if (!isNativeApp()) {
    const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    if (result.user.uid !== user.uid) {
      await signOut(firebaseAuth);
      throw new Error("현재 계정과 동일한 Google 계정으로 다시 로그인해주세요.");
    }
    return result;
  }

  const credential = await getNativeGoogleCredential();
  return reauthenticateWithCredential(user, credential);
};

export const signOutEverywhere = async () => {
  await signOut(firebaseAuth);
  if (isNativeApp()) {
    await FirebaseAuthentication.signOut();
  }
};
