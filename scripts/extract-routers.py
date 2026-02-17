#!/usr/bin/env python3
"""
Carefully extract router groups from routers.ts into separate files.
Uses brace-matching to find exact boundaries of each router definition.
"""
import re
import sys

def find_router_end(lines, start_idx):
    """Find the end of a router({...}) definition by matching braces."""
    brace_count = 0
    paren_count = 0
    started = False
    for i in range(start_idx, len(lines)):
        for ch in lines[i]:
            if ch == '{':
                brace_count += 1
                started = True
            elif ch == '}':
                brace_count -= 1
            elif ch == '(':
                paren_count += 1
            elif ch == ')':
                paren_count -= 1
        # Router ends when we close the router({ }) call - braces back to 0 and line ends with }),
        if started and brace_count == 0:
            return i
    return len(lines) - 1

def extract_router_block(lines, start_idx):
    """Extract a single router block including any comment above it."""
    end_idx = find_router_end(lines, start_idx)
    
    # Include comment lines above the router definition
    comment_start = start_idx
    while comment_start > 0 and lines[comment_start - 1].strip().startswith('//'):
        comment_start -= 1
    
    block_lines = lines[comment_start:end_idx + 1]
    return block_lines, comment_start, end_idx

def main():
    with open('server/routers.ts') as f:
        lines = f.readlines()
    
    # Find all router definitions
    pattern = re.compile(r'^  (\w+): router\(\{')
    routers = {}
    for i, line in enumerate(lines):
        m = pattern.match(line)
        if m:
            routers[m.group(1)] = i
    
    # Define extraction groups
    groups = {
        'analysisRouter': ['mixReport', 'structure', 'benchmark', 'timeline', 'dawExport', 'moodEnergy', 'insights', 'matrix', 'csvExport'],
        'collaborationRouter': ['collaboration', 'comment'],
        'portfolioRouter': ['portfolio', 'completion', 'abCompare', 'trackNote'],
        'playlistRouter': ['playlist', 'reorder'],
        'subscriptionRouter': ['subscription', 'usage'],
        'creativeRouter': ['artwork', 'mastering', 'sentimentHeatmap'],
    }
    
    for group_name, router_names in groups.items():
        print(f"\n=== {group_name} ===")
        total_lines = 0
        for name in router_names:
            if name in routers:
                start = routers[name]
                block, cs, ce = extract_router_block([l.rstrip('\n') for l in lines], start)
                total_lines += len(block)
                print(f"  {name}: lines {cs+1}-{ce+1} ({len(block)} lines)")
            else:
                print(f"  {name}: NOT FOUND")
        print(f"  Total: ~{total_lines} lines")

if __name__ == '__main__':
    main()
