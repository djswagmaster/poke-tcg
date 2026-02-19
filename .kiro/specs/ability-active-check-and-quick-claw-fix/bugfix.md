# Bugfix Requirements Document

## Introduction

This bugfix addresses two distinct issues in the Pokemon card game:

1. **Active-only ability enforcement**: Several abilities that should only be usable when the Pokemon is active are currently usable from the bench. Specifically, Arceus's "Creation" ability and Kricketune's "Befuddling Melody" ability are missing the `activeOnly` flag.

2. **Quick Claw interaction with copied attacks**: The Quick Claw held item (which reduces attack energy cost by 2) is not applying its cost reduction to attacks copied through Ditto's "Improvised Attack" ability, and potentially Mew's "Versatility" ability.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN Arceus is on the bench THEN the system allows the "Creation" ability to be activated (spend 1 mana to gain 2 mana)

1.2 WHEN Kricketune is on the bench THEN the system allows the "Befuddling Melody" ability to be activated (confuse opponent's active Pokemon)

1.3 WHEN Ditto has Quick Claw equipped and uses "Improvised Attack" to copy an opponent's attack THEN the system does not reduce the copied attack's energy cost by 2

1.4 WHEN Mew has Quick Claw equipped and uses "Versatility" to copy a bench ally's attack THEN the system may not reduce the copied attack's energy cost by 2

### Expected Behavior (Correct)

2.1 WHEN Arceus is on the bench THEN the system SHALL prevent the "Creation" ability from being activated and display an appropriate message

2.2 WHEN Kricketune is on the bench THEN the system SHALL prevent the "Befuddling Melody" ability from being activated and display an appropriate message

2.3 WHEN Ditto has Quick Claw equipped and uses "Improvised Attack" to copy an opponent's attack THEN the system SHALL reduce the copied attack's energy cost by 2 (minimum 0)

2.4 WHEN Mew has Quick Claw equipped and uses "Versatility" to copy a bench ally's attack THEN the system SHALL reduce the copied attack's energy cost by 2 (minimum 0)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Arceus is the active Pokemon THEN the system SHALL CONTINUE TO allow the "Creation" ability to be activated

3.2 WHEN Kricketune is the active Pokemon THEN the system SHALL CONTINUE TO allow the "Befuddling Melody" ability to be activated

3.3 WHEN Ditto uses "Improvised Attack" without Quick Claw equipped THEN the system SHALL CONTINUE TO calculate energy costs normally

3.4 WHEN a Pokemon with Quick Claw uses its own attacks (not copied) THEN the system SHALL CONTINUE TO reduce the energy cost by 2

3.5 WHEN abilities that are correctly marked as bench-usable (e.g., Slurpuff's "Yummy Delivery") are used from the bench THEN the system SHALL CONTINUE TO function normally

3.6 WHEN Quick Claw is consumed after use THEN the system SHALL CONTINUE TO discard it and prevent further cost reductions

3.7 WHEN other held items interact with attack costs (e.g., Thick Aroma) THEN the system SHALL CONTINUE TO apply their effects correctly
