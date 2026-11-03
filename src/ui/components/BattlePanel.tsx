import { useEffect, useRef, type CSSProperties } from "react";
import type Phaser from "phaser";
import { BAL, DATA } from "../../data";
import { worldCount } from "../../core";
import { dispatch, useGame } from "../../app/store";
import { isHeld, whenStarted } from "../../app/session";
import { haptics } from "../../services";
import { createBattleGame } from "../../render/BattleScene";
import { t } from "../i18n";
import { useUi } from "../uiStore";
import { Chunky } from "./Chunky";
import { ArrowRightIcon, SkullIcon } from "./Icons";
import { TopHud } from "./TopHud";
import s from "./hud.module.css";

export function worldLabel(world: number): string {
  const w = DATA.worlds[world - 1];
  return t("battle.worldLabel", { n: world, name: w?.name ?? "" });
}

/**
 * A boss is down: the battle stops and asks, this world again or the next one? With no answer it goes
 * on to the next world when the countdown runs out (in the last world it goes again).
 */
function BossChoice() {
  const open = useGame((g) => g.battle.phase === "choice");
  const world = useGame((g) => g.battle.stage);
  const left = useGame((g) =>
    g.battle.phase === "choice" ? Math.max(0, g.battle.phaseTime) : 0,
  );
  const reward = useUi((u) =>
    u.afterBoss?.world === world ? u.afterBoss : null,
  );
  if (!open) return null;
  const last = world >= worldCount();
  const secs = Math.ceil(left);
  const total = BAL.worlds.choiceSeconds;
  const pick = (next: boolean) => {
    haptics.impact(next ? "medium" : "light");
    dispatch({ type: "afterBoss", next });
  };
  return (
    <div
      className={s.choice}
      role="dialog"
      aria-label={t("choice.cleared", { n: world })}
    >
      <div className={s.choiceCard}>
        <Chunky
          text={t("choice.cleared", { n: world })}
          size={66}
          grad="gold"
        />
        {reward?.firstTime && (
          <span className={s.choiceReward}>
            {t("choice.rewards", { gems: reward.gems })}
          </span>
        )}
        <div className={s.choiceBtns}>
          <button
            className={`btn blue ${s.choiceBtn}`}
            onClick={() => pick(false)}
          >
            {t("choice.again")}
            {last && (
              <span className={s.choiceAuto}>
                {t("choice.auto", { s: secs })}
              </span>
            )}
          </button>
          {!last && (
            <button
              className={`btn breathe ${s.choiceBtn} ${s.choiceNext}`}
              onClick={() => pick(true)}
            >
              <span
                className={s.choiceFill}
                style={
                  { "--fill": `${(1 - left / total) * 100}%` } as CSSProperties
                }
              />
              <span className={s.choiceLabel}>
                {t("choice.next")}
                <ArrowRightIcon size="sm" />
              </span>
              <span className={s.choiceAuto}>
                {t("choice.auto", { s: secs })}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BattlePanel() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | null = null;
    if (host.current) game = createBattleGame(host.current);
    // Behind the title screen the battle waits too, drawing nothing, and starts on PLAY (world card and all).
    if (isHeld()) game?.pause();
    const off = whenStarted(() => game?.resume());
    return () => {
      off();
      game?.destroy(true);
    };
  }, []);

  const world = useGame((g) => g.battle.stage);
  const wave = useGame((g) => g.battle.wave);
  // (The world's title card on arrival and the "Too tough!" notice are drawn in the battle canvas, in
  // its pixel font: src/render/BattleScene.ts.)
  const waves = BAL.stages.wavesPerStage;
  const inHeist = useGame((g) => !!g.heist.run);
  const drag = useUi((u) => u.drag);
  // Nudge: nothing worn yet but gear waiting in the bag (the tutorial has its own while it runs).
  const bare = useGame(
    (g) =>
      g.dumpster.beginner.state === "done" &&
      g.inventory.length > 0 &&
      Object.values(g.equipped).every((it) => !it),
  );

  return (
    <div className={s.battle} data-drop="equip">
      <div className={s.canvasHost} ref={host} />
      {drag && (
        <div className={`${s.dropRing} ${drag.over ? s.dropRingOn : ""}`}>
          <span className={s.dropLabel}>{t("drag.ring")}</span>
        </div>
      )}
      {bare && !drag && (
        <div className={s.dragTip}>
          {t("drag.tip")}
          <span className={s.dragTipArrow} />
        </div>
      )}
      <TopHud />
      <BossChoice />
      {/* The Alley's wave track (a heist shows its own progress on the Heist tab and the battle's badge). */}
      {!inHeist && (
        <div className={s.battleActions}>
          <button
            className={s.waveBox}
            onClick={() => useUi.getState().setTab("worlds")}
            aria-label={worldLabel(world)}
          >
            <div className={s.waveTrack}>
              {Array.from({ length: waves }, (_, i) => {
                const boss = i === waves - 1;
                return (
                  <span key={i} className={s.waveSeg}>
                    {i > 0 && (
                      <span
                        className={`${s.waveLine} ${i <= wave ? s.waveLineDone : ""}`}
                      />
                    )}
                    {boss ? (
                      <SkullIcon
                        size="sm"
                        className={i < wave ? s.waveDone : ""}
                      />
                    ) : (
                      <span
                        className={[
                          s.waveDot,
                          i < wave ? s.waveDotDone : "",
                          i === wave ? s.waveDotNow : "",
                        ].join(" ")}
                      />
                    )}
                  </span>
                );
              })}
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
