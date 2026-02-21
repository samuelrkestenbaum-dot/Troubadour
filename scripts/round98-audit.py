import anthropic
import os
import json

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

prompt = """You are a senior UX architect auditing three new features for Troubadour, an AI music review platform. Rate each feature 1-10 and provide brief recommendations.

## Feature 1: Persist Review Length Preference
The user's preferred review depth (brief/standard/detailed) is now saved to the database when they change it in the Advanced Options dialog. On next visit, it pre-selects their saved preference. A confirmation message appears below the options.

Implementation:
- useState initialized with user's saved preference from auth.me query
- useEffect syncs local state when user data loads
- tRPC mutation fires on selection change to persist to DB
- Confirmation text: "Preference saved — future reviews will default to {length}." / "Your preferred depth is remembered across sessions."
- Backend: auth.updatePreferredReviewLength mutation with Drizzle ORM

## Feature 2: Smart Prefetch Learning for Insights Tabs
Builds on Round 97's hover-based prefetch. Now tracks tab visit patterns in localStorage and on mount, prefetches the user's top 2 most-visited tabs (minimum 3 visits threshold) alongside the default overview tab.

Implementation:
- recordTabVisit(tab) called on every tab change via useEffect
- getTopTabs(2) returns tabs with 3+ visits, sorted by frequency
- prefetchSmart() on mount: prefetches overview + top user tabs
- Hover-based prefetch still works for tabs not yet prefetched
- localStorage-based, no server round-trip for visit tracking

## Feature 3: Version Comparison Annotations
Adds optional text input fields in the Version History comparison mode. Users can annotate each review version with notes like "Re-recorded vocals" or "New bridge section". Notes are saved to the database via tRPC mutation.

Implementation:
- VersionNoteInput component with text input, Save button, and success feedback
- Saves via trpc.review.updateVersionNote.useMutation()
- Displayed alongside each version panel in the comparison view
- Max 500 characters, Enter key saves, green checkmark on success
- Backend: review.updateVersionNote mutation with user ownership check

Please evaluate:
1. UX quality and intuitiveness (1-10)
2. Technical implementation quality (1-10)
3. Alignment with power-user workflow enhancement goal (1-10)
4. Any concerns or recommendations
5. Overall score (1-10)

Respond in JSON format:
{
  "feature1": { "ux": N, "technical": N, "alignment": N, "notes": "..." },
  "feature2": { "ux": N, "technical": N, "alignment": N, "notes": "..." },
  "feature3": { "ux": N, "technical": N, "alignment": N, "notes": "..." },
  "overall": N,
  "recommendations": ["..."]
}"""

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1500,
    messages=[{"role": "user", "content": prompt}],
)

text = response.content[0].text
print("Claude Audit Result:")
print(text)

# Parse JSON
import re
match = re.search(r'\{[\s\S]*\}', text)
if match:
    result = json.loads(match.group())
    print("\n=== SUMMARY ===")
    print(f"Feature 1 (Review Length): UX={result['feature1']['ux']}, Tech={result['feature1']['technical']}, Align={result['feature1']['alignment']}")
    print(f"Feature 2 (Smart Prefetch): UX={result['feature2']['ux']}, Tech={result['feature2']['technical']}, Align={result['feature2']['alignment']}")
    print(f"Feature 3 (Version Notes): UX={result['feature3']['ux']}, Tech={result['feature3']['technical']}, Align={result['feature3']['alignment']}")
    print(f"Overall: {result['overall']}/10")
