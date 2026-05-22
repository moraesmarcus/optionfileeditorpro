from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox


class OptionFileEditorPro(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Option File Editor Pro")
        self.geometry("560x260")
        self.minsize(460, 220)

        self.selected_file = tk.StringVar(value="Nenhum arquivo carregado.")
        self.file_details = tk.StringVar(value="")

        self._build_screen()

    def _build_screen(self):
        container = tk.Frame(self, padx=24, pady=24)
        container.pack(fill=tk.BOTH, expand=True)

        title = tk.Label(
            container,
            text="Option File Editor Pro",
            font=("Segoe UI", 18, "bold"),
            anchor="w",
        )
        title.pack(fill=tk.X)

        subtitle = tk.Label(
            container,
            text="Carregue qualquer arquivo para iniciar a edição.",
            font=("Segoe UI", 10),
            anchor="w",
        )
        subtitle.pack(fill=tk.X, pady=(4, 20))

        load_button = tk.Button(
            container,
            text="Carregar arquivo",
            font=("Segoe UI", 11),
            command=self.load_file,
            height=2,
        )
        load_button.pack(fill=tk.X)

        selected_label = tk.Label(
            container,
            textvariable=self.selected_file,
            font=("Segoe UI", 10, "bold"),
            anchor="w",
            wraplength=500,
            justify=tk.LEFT,
        )
        selected_label.pack(fill=tk.X, pady=(20, 6))

        details_label = tk.Label(
            container,
            textvariable=self.file_details,
            font=("Segoe UI", 9),
            anchor="w",
            wraplength=500,
            justify=tk.LEFT,
        )
        details_label.pack(fill=tk.X)

    def load_file(self):
        file_path = filedialog.askopenfilename(
            title="Selecione um arquivo",
            filetypes=[("Todos os arquivos", "*.*")],
        )

        if not file_path:
            return

        path = Path(file_path)

        try:
            size = path.stat().st_size
        except OSError as error:
            messagebox.showerror("Erro ao carregar", f"Nao foi possivel abrir o arquivo:\n{error}")
            return

        self.selected_file.set(str(path))
        self.file_details.set(f"Nome: {path.name}\nTamanho: {size:,} bytes")


if __name__ == "__main__":
    app = OptionFileEditorPro()
    app.mainloop()
