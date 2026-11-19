import { lazy } from 'react';

/**
 * Dialogs and overlays that only open on demand, split out of the main bundle. Each one
 * loads the first time it's shown; the engine code it needs (the design review, the
 * level verifier, the lessons) comes with it.
 */
export const LearnHub = lazy(() => import('./dialogs/LearnHub').then((m) => ({ default: m.LearnHub })));
export const ReviewDialog = lazy(() => import('./dialogs/ReviewDialog').then((m) => ({ default: m.ReviewDialog })));
export const CompareDialog = lazy(() => import('./dialogs/CompareDialog').then((m) => ({ default: m.CompareDialog })));
export const LevelMakerDialog = lazy(() => import('./dialogs/LevelMakerDialog').then((m) => ({ default: m.LevelMakerDialog })));
export const AchievementsDialog = lazy(() => import('./dialogs/AchievementsDialog').then((m) => ({ default: m.AchievementsDialog })));
export const CommandPalette = lazy(() => import('./dialogs/CommandPalette').then((m) => ({ default: m.CommandPalette })));
export const IncidentOverDialog = lazy(() => import('./dialogs/IncidentOverDialog').then((m) => ({ default: m.IncidentOverDialog })));
export const WelcomeScreen = lazy(() => import('./guide/WelcomeScreen').then((m) => ({ default: m.WelcomeScreen })));
export const Tour = lazy(() => import('./guide/Tour').then((m) => ({ default: m.Tour })));
export const VoiceMenu = lazy(() => import('./audio/VoiceMenu').then((m) => ({ default: m.VoiceMenu })));
