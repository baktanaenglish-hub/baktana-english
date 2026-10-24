import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'react';

/**
 * The Android back button. Without a listener Android closes the app on every press, even in
 * the middle of a lesson. Screens and dialogs that should answer it register a handler with
 * useBackButton() (the latest one registered wins); otherwise the app-wide handler set with
 * useBackFallback() runs. When nothing handles the press (the home screen) the app goes to the
 * background, like other Android apps.
 */

type Handler = () => void;

const handlers: { current: Handler }[] = [];
let fallback: { current: () => boolean } | null = null;

/** Runs the handler for one back press; false when nothing handled it. */
export function handleBack(): boolean {
  const top = handlers.at(-1);
  if (top) {
    top.current();
    return true;
  }
  return fallback?.current() ?? false;
}

/** Answers the back button with `handler` while this component is mounted and `enabled`. */
export function useBackButton(handler: Handler, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    handlers.push(ref);
    return () => {
      const i = handlers.lastIndexOf(ref);
      if (i !== -1) handlers.splice(i, 1);
    };
  }, [enabled]);
}

/** The app-wide handler, used when no screen registered its own; it returns false to leave the app. */
export function useBackFallback(handler: () => boolean) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    fallback = ref;
    return () => {
      if (fallback === ref) fallback = null;
    };
  }, []);
}

/** Starts listening to the Android back button (browsers have their own back and are left alone). */
export function listenBackButton() {
  // The end-to-end tests press "back" through this (there is no Android back button in a browser).
  if (import.meta.env.DEV) (window as unknown as { __back?: () => boolean }).__back = handleBack;
  if (!Capacitor.isNativePlatform()) return;
  void NativeApp.addListener('backButton', () => {
    if (!handleBack()) void NativeApp.minimizeApp();
  });
}
