#!/usr/bin/env python3
"""Copy the complete editable baseline without overwriting an existing project."""
import argparse
import shutil
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    skill = Path(__file__).resolve().parents[1]
    source = skill / 'assets/template'
    output = args.output.expanduser().resolve()
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        parser.error('Output must be an absent or empty directory; existing work will not be overwritten.')
    if output.is_relative_to(skill):
        parser.error('Choose a working directory outside the installed skill.')
    shutil.copytree(source, output, dirs_exist_ok=True)
    print(output)

if __name__ == '__main__':
    main()
