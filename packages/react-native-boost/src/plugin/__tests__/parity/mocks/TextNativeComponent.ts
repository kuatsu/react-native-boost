import { NativeTextCapturer, NativeVirtualTextCapturer } from '../capture';

// `Text.js` renders `NativeText` for a root text and `NativeVirtualText` for nested text. Since
// RN 0.86 it renders `NativeSelectableText` for `selectable` text; with `enablePreparedTextLayout`
// off (the RN default) that export IS `NativeText`, so it maps to the same capturer.
export const NativeText = NativeTextCapturer;
export const NativeVirtualText = NativeVirtualTextCapturer;
export const NativeSelectableText = NativeTextCapturer;
