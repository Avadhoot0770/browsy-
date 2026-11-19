/**
 * Human-Readable Page Summary Generator for Browsy Page Intelligence
 * Provides concise operational overview for developer debugging and future AI context.
 */

import type {
  PageHeading,
  InteractiveElement,
  FormInfo,
  RepeatedItemGroup,
  PriceInfo,
  RatingInfo,
} from "./types";

export function generatePageSummary(params: {
  hostname: string;
  title: string;
  headings: PageHeading[];
  searchInputs: InteractiveElement[];
  buttons: InteractiveElement[];
  inputs: InteractiveElement[];
  links: InteractiveElement[];
  forms: FormInfo[];
  repeatedGroups: RepeatedItemGroup[];
  prices: PriceInfo[];
  ratings: RatingInfo[];
}): string {
  const {
    hostname,
    title,
    headings,
    searchInputs,
    buttons,
    inputs,
    links,
    forms,
    repeatedGroups,
    prices,
    ratings,
  } = params;

  const totalRepeatedItems = repeatedGroups.reduce((acc, g) => acc + g.count, 0);
  const primaryRepeatedType = repeatedGroups[0]?.inferredType || "generic";

  const lines: string[] = [
    `BROWSY PAGE SUMMARY`,
    `Website: ${hostname || "Unknown Host"}`,
    `Page: ${title || "Untitled Page"}`,
    ``,
    `Interactive Elements:`,
    `- Search fields: ${searchInputs.length}`,
    `- Buttons: ${buttons.length}`,
    `- Forms: ${forms.length}`,
    `- Other input controls: ${inputs.length}`,
    `- Visible links: ${links.length}`,
    ``,
    `Content Structure:`,
    `- Headings: ${headings.length} detected (Primary: "${headings[0]?.text || title}")`,
    `- Repeated groups: ${repeatedGroups.length} (${totalRepeatedItems} total ${primaryRepeatedType} items)`,
    `- Detected prices: ${prices.length > 0 ? `${prices.length} instances (e.g. ${prices[0].raw})` : "None"}`,
    `- Detected ratings: ${ratings.length > 0 ? `${ratings.length} instances (e.g. ${ratings[0].raw})` : "None"}`,
  ];

  return lines.join("\n");
}
