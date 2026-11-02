import type { PersonaId } from '../../../shared/call';
import type { VoiceProfile } from '../voice-pick';
import { baristaVoice } from './barista';
import { friendVoice } from './friend';
import { interviewerVoice } from './interviewer';
import { teacherVoice } from './teacher';

/** Each call character's voice (one file per character, so each can be tuned on its own). */
export const PERSONA_VOICES: Record<PersonaId, VoiceProfile> = {
  teacher: teacherVoice,
  friend: friendVoice,
  barista: baristaVoice,
  interviewer: interviewerVoice,
};
