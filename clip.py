import pyperclip
import subprocess
from pathlib import Path


# gitコマンドを使って.gitignoreで除外されていないファイルのリストを取得
def get_git_files(base_path="."):
    command = """git ls-files; git ls-files --others --exclude-standard | Sort-Object -Unique"""
    # PowerShellスクリプトを実行
    result = subprocess.run(
        ["powershell", "-Command", command],
        cwd=base_path,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return []
    files = result.stdout.split("\n")
    return [Path(base_path) / f for f in files if f]  # ファイルのパスリストを返す


def format_file_content(file_path, file_type):
    # ファイルが無ければ空文字
    if not Path(file_path).exists():
        return ""
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()
    return f"{file_path}\n```{file_type}\n{content}\n```\n"


def main():
    script_dir = Path(__file__).parent
    git_files = get_git_files(script_dir)

    all_contents = ""

    extensions = [".svelte", ".js", ".ts"]
    filenames = ["package.json"]

    for file_path in git_files:
        if file_path.suffix in extensions or file_path.name in filenames:
            rel_path = file_path.relative_to(script_dir)
            file_type = file_path.suffix.lstrip(".")
            all_contents += format_file_content(file_path, file_type)

    pyperclip.copy(all_contents)


if __name__ == "__main__":
    main()
