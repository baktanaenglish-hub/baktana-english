package com.baktana.english;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/**
 * Speaking exercises (see src/lib/listen.ts): listens for one English sentence with Android's
 * speech recognizer and returns its guesses, best first. Android's WebView has no Web Speech API.
 * Rejects with code "denied" (no microphone permission), "no-speech", "unavailable" or "error".
 */
@CapacitorPlugin(
    name = "SpeechRecognizer",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class SpeechRecognizerPlugin extends Plugin {

    private SpeechRecognizer recognizer;
    private PluginCall pending;

    @PluginMethod
    public void listen(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermission");
            return;
        }
        start(call);
    }

    @PermissionCallback
    private void microphonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            start(call);
        } else {
            call.reject("Microphone permission denied", "denied");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) recognizer.stopListening();
        });
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        getActivity().runOnUiThread(() -> release("error"));
    }

    private void start(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition unavailable", "unavailable");
            return;
        }
        String lang = call.getString("lang", "en-US");
        getActivity().runOnUiThread(() -> {
            release("no-speech");
            pending = call;
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new Listener());
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            recognizer.startListening(intent);
        });
    }

    /** Ends the current session (UI thread), rejecting its call with `code` if still open. */
    private void release(String code) {
        if (pending != null) {
            pending.reject("Listening ended", code);
            pending = null;
        }
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
    }

    private class Listener implements RecognitionListener {

        @Override
        public void onResults(Bundle results) {
            ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (pending != null) {
                JSObject result = new JSObject();
                result.put("matches", new JSArray(matches != null ? matches : new ArrayList<String>()));
                pending.resolve(result);
                pending = null;
            }
            release("error");
        }

        @Override
        public void onError(int error) {
            String code;
            switch (error) {
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                    code = "no-speech";
                    break;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    code = "denied";
                    break;
                default:
                    code = "error";
            }
            release(code);
        }

        @Override
        public void onReadyForSpeech(Bundle params) {}

        @Override
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onPartialResults(Bundle partialResults) {}

        @Override
        public void onEvent(int eventType, Bundle params) {}
    }
}
