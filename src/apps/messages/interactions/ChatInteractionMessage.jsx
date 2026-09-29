import React from 'react';
import CoinFlipInteraction from './CoinFlipInteraction';
import DiceRollInteraction from './DiceRollInteraction';
import RockPaperScissorsInteraction from './RockPaperScissorsInteraction';
import LotteryDrawInteraction from './LotteryDrawInteraction';
import IntimacyQaInteraction from './IntimacyQaInteraction';
import TruthOrDareInteraction from './TruthOrDareInteraction';
import DivinationInteraction from './divination/DivinationInteraction';
import { INTERACTION_TYPES } from './interactionRules';

export const ChatInteractionMessage = ({
  message,
  character,
  onResolved,
}) => {
  const interactionType = message?.metadata?.interactionType;

  if (interactionType === INTERACTION_TYPES.COIN) {
    return (
      <CoinFlipInteraction
        message={message}
        onResolved={onResolved}
      />
    );
  }

  if (interactionType === INTERACTION_TYPES.DICE) {
    return (
      <DiceRollInteraction
        message={message}
        onResolved={onResolved}
      />
    );
  }

  if (interactionType === INTERACTION_TYPES.RPS) {
    return (
      <RockPaperScissorsInteraction
        message={message}
        character={character}
        onResolved={onResolved}
      />
    );
  }

  if (interactionType === INTERACTION_TYPES.LOTTERY) {
    return (
      <LotteryDrawInteraction
        message={message}
        onResolved={onResolved}
      />
    );
  }

  if (interactionType === INTERACTION_TYPES.INTIMACY_QA) {
    return (
      <IntimacyQaInteraction
        message={message}
        onResolved={onResolved}
      />
    );
  }

  if (interactionType === INTERACTION_TYPES.DIVINATION) {
    return (
      <DivinationInteraction
        message={message}
      />
    );
  }

  if (interactionType === INTERACTION_TYPES.TRUTH_OR_DARE) {
    return (
      <TruthOrDareInteraction
        message={message}
        character={character}
      />
    );
  }

  return null;
};

export default ChatInteractionMessage;