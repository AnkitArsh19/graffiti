/**
 * VoiceStoryboardHUD
 *
 * A thin wrapper / alias for the VoiceCommander component that is pre-configured
 * for Live Storyboard mode. It surfaces the same speech-recognition → Gemini pipeline,
 * renders generated storyboard cards directly onto the canvas via `onInsertStoryboardElements`,
 * and plays back an audio confirmation through `window.speechSynthesis.speak()`.
 *
 * Usage:
 *   <VoiceStoryboardHUD
 *     isListening={voiceActive}
 *     onToggle={toggleVoice}
 *     onInsertStoryboardElements={handleInsertElements}
 *     existingElements={elements}
 *     // ... other VoiceCommander props
 *   />
 */

export { VoiceCommander as VoiceStoryboardHUD } from "./VoiceCommander";
export type { } from "./VoiceCommander";
