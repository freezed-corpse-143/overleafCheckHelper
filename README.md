# Overleaf Text Change Monitor - README

## Overview
This is a Tampermonkey user script that monitors content changes in the Overleaf LaTeX editor and performs various checks on the document. It displays the results in a floating window within the editor interface.

## Features
The script checks for the following LaTeX issues:

# LaTeX Document Quality Checks

## 1. Missing Punctuation at Equation Endings
- Detects equations ending without proper punctuation (.,)
- Scans for patterns where equations end without trailing punctuation before the `\end{equation}` tag

## 2. Duplicate Abbreviation Definitions
- Identifies repeated abbreviations defined in parentheses (e.g., (abbr))
- Excludes common exceptions: 'a', 'b', '1', '2', '3', 'lr'

## 3. Missing Braces After Custom Commands
- Checks for missing `{}` braces after user-defined commands created via `\newcommand`
- Extracts all custom commands from the document and validates proper usage

## 4. Improper LaTeX Quote Usage
- Detects incorrect combinations of single and double quotes
- Identifies non-standard LaTeX quote patterns and mixed quote styles

## 5. Incorrect Dash Character Usage
- Flags inappropriate use of en-dash (–) or em-dash (—) characters
- Scans for non-LaTeX dash characters that should be replaced with proper LaTeX equivalents

## 6. Improper Period Usage
- Detects periods used incorrectly (e.g., space before period, periods before lowercase letters)
- Excludes common domain extensions: .com, .org, .net, .gov, .edu

## 7. Misplaced 'Where' Clause After Equations
- Identifies 'where' clauses that are too far from their corresponding equations
- Checks for excessive newlines between equation end and 'where' keyword

## 8. Unmerged Adjacent Citations
- Detects consecutive `\cite` commands that should be merged into a single citation
- Example: `\cite{a}\cite{b}` should be formatted as `\cite{a,b}`

## 9. Inappropriate Self-Reference to "Method"
- Detects phrases like "our method" or "Our method" that may inappropriately refer to the author's own work
- Avoids self-referential language in academic writing contexts

## 10. Inconsistent Capitalization in Section Titles
- Checks section headings (`\section`, `\subsection`, etc.) for proper title case formatting
- Identifies lowercase words within section titles that should be capitalized
- Extracts and analyzes content within braces for capitalization patterns

## 11. Unused Abbreviation Definitions
- Identifies abbreviations defined in parentheses that are never used elsewhere in the document
- Tracks both definition positions and usage occurrences throughout the text
- Excludes common single-letter abbreviations and special cases: 'a', 'b', '1', '2', '3', 'lr', 'R'
- Reports line numbers where abbreviations are defined but not utilized

## 12. Missing Label Attributes in Figures and Tables
- Detects figures and tables (`\begin{figure}`, `\begin{table}`) that lack `\label` attributes
- Validates proper labeling of all visual elements for cross-referencing

## 13. Unreferenced Figures and Tables
- Identifies labeled figures and tables that are never referenced via `\ref` commands
- Ensures all visual elements are properly cited within the document text

## 14. Improper Reference Formatting
- Detects `\ref` commands that are not properly preceded by a tilde character (`~`)
- Validates correct LaTeX reference formatting to prevent line breaks between references and preceding text

## 15. Excessive Line Breaks Before Itemize
- Identifies `\begin{itemize}` environments that have more than one blank line preceding them
- Ensures proper spacing between itemize and preceding paragraphs

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