# Overleaf Text Change Monitor - README

## Overview
This is a Tampermonkey user script that monitors content changes in the Overleaf LaTeX editor and performs various checks on the document. It displays the results in a floating window within the editor interface.

## Features
The script checks for the following LaTeX issues:

1. **Missing punctuation at the end of equations**
   - Detects equations ending without proper punctuation (.,)

2. **Duplicate abbreviation definitions**
   - Identifies repeated abbreviations in parentheses (e.g., (abbr))
   - Excludes common exceptions like 'a', 'b', '1', '2', '3', 'lr'

3. **Unhandled spaces after custom commands**
   - Checks for spaces after user-defined commands (from \newcommand)
   - Flags cases where spaces might affect command behavior

4. **Improper LaTeX quote usage**
   - Detects incorrect combinations of single and double quotes
   - Identifies non-LaTeX style quote patterns

5. **Incorrect dash usage**
   - Flags inappropriate use of en-dash (–) or em-dash (—)

6. **Improper period usage**
   - Detects periods used incorrectly (e.g., space before period)
   - Excludes common domains (.com, .org, etc.)

7. **Misplaced 'where' after equations**
   - Identifies 'where' clauses that are too far from their equations
   - Checks for excessive newlines between equation end and 'where'

8. **Unmerged adjacent citations**
   - Detects consecutive \cite commands that could be merged
   - Example: \cite{a}\cite{b} should be \cite{a,b}

9. **Inappropriate self-reference to "method"**
   - Detects phrases like "our method" or "Our method" that may inappropriately refer to the author's own work
   - Avoids self-referential language in academic writing

10. **Inconsistent capitalization in section titles**
    - Checks section headings (e.g., \section, \subsection) for proper title case
    - Identifies lowercase words that should be capitalized in section titles
    - Extracts content within braces to analyze capitalization patterns

11. **Unused abbreviation definitions**
    - Identifies abbreviations defined in parentheses that are never used elsewhere in the text
    - Tracks both definition positions and usage occurrences
    - Excludes common single-letter abbreviations and special cases
    - Reports line numbers where abbreviations are defined but not utilized

## Installation
1. Install Tampermonkey extension for your browser
2. Create a new script and paste the provided code
3. Save the script

## Usage
- The floating window appears automatically when editing LaTeX documents in Overleaf
- The window shows real-time detection results as you type
- Click on line numbers in the results to jump to the corresponding line
- The window is draggable for convenient positioning

## Technical Notes
- Uses MutationObserver to detect editor changes
- Performs checks with a 300ms delay to avoid excessive processing
- Maintains a clean, unobtrusive UI that integrates with Overleaf
- Highlights problematic lines temporarily when clicked

## Limitations
- Checks are performed on the visible editor content only
- Some checks may produce false positives in complex cases
- Requires Tampermonkey or similar userscript manager