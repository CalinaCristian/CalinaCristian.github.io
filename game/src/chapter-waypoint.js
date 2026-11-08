// Navigation results belong to the destination used at the start of the update.
// A manual-arrival handler may clear that destination and restore the story route.
export function chapterWaypointReached(game, player, navigation) {
    const objective = game.objective;
    if (game.freeRoam || !game.ch?.waypoint || game.chapterDone || !objective?.waypoint) return false;
    if (Math.hypot(objective.x - player.x, objective.z - player.z) < 30) return true;
    const { destination, manual, info } = navigation || {};
    return !manual && !!destination && !!info && Number.isFinite(info.remaining) && info.remaining < 25 &&
        Math.hypot(destination.x - objective.x, destination.z - objective.z) < 0.01;
}
