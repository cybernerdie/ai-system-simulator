import { lazy } from 'react';
import { importOrReload } from '../lib/freshBuild';

/**
 * Dialogs and overlays that only open on demand, split out of the main bundle. Each one
 * loads the first time it's shown; the engine code it needs (the design review, the
 * level verifier, the lessons) comes with it. If a file has gone because a new version was
 * deployed while the tab was open, the page reloads into the new build.
 */
export const LearnHub = lazy(() => importOrReload(() => import('./dialogs/LearnHub')).then((m) => ({ default: m.LearnHub })));
export const ReviewDialog = lazy(() => importOrReload(() => import('./dialogs/ReviewDialog')).then((m) => ({ default: m.ReviewDialog })));
export const CompareDialog = lazy(() => importOrReload(() => import('./dialogs/CompareDialog')).then((m) => ({ default: m.CompareDialog })));
export const LevelMakerDialog = lazy(() => importOrReload(() => import('./dialogs/LevelMakerDialog')).then((m) => ({ default: m.LevelMakerDialog })));
export const AchievementsDialog = lazy(() => importOrReload(() => import('./dialogs/AchievementsDialog')).then((m) => ({ default: m.AchievementsDialog })));
export const CommandPalette = lazy(() => importOrReload(() => import('./dialogs/CommandPalette')).then((m) => ({ default: m.CommandPalette })));
export const IncidentOverDialog = lazy(() => importOrReload(() => import('./dialogs/IncidentOverDialog')).then((m) => ({ default: m.IncidentOverDialog })));
export const WelcomeScreen = lazy(() => importOrReload(() => import('./guide/WelcomeScreen')).then((m) => ({ default: m.WelcomeScreen })));
export const Tour = lazy(() => importOrReload(() => import('./guide/Tour')).then((m) => ({ default: m.Tour })));
export const VoiceMenu = lazy(() => importOrReload(() => import('./audio/VoiceMenu')).then((m) => ({ default: m.VoiceMenu })));
