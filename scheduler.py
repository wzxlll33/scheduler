import tkinter as tk
from tkinter import messagebox
import calendar
from datetime import date
import json
import os
import uuid
import sys


class WarmScheduleApp:
    def __init__(self, root):
        self.root = root
        self.root.title("M0MoNa的日程")
        self.root.geometry("1000x720")
        self.root.configure(bg="#FAF3E8")
        self.root.minsize(850, 650)

        self.colors = {
            'bg': '#FAF3E8',
            'card': '#FFFFFF',
            'primary': '#E8956A',
            'primary_hover': '#D4845A',
            'secondary': '#D4A373',
            'text': '#5D4037',
            'text_light': '#A1887F',
            'border': '#E0D5C5',
            'selected': '#FFE8D6',
            'weekend': '#FFB7B2',
            'other_month': '#D7CCC8',
            'dot': '#E8956A'
        }

        # 数据文件路径（兼容 PyInstaller 打包后环境）
        self.app_dir = self.get_app_dir()
        self.data_file = os.path.join(self.app_dir, "schedule_data.json")
        self.data = self.load_data()

        self.today = date.today()
        self.view_date = self.today
        self.selected_date = self.today

        self.font_title = ("Microsoft YaHei UI", 22, "bold")
        self.font_header = ("Microsoft YaHei UI", 14, "bold")
        self.font_normal = ("Microsoft YaHei UI", 11)
        self.font_small = ("Microsoft YaHei UI", 9)
        self.font_bold_small = ("Microsoft YaHei UI", 10, "bold")

        self.setup_ui()
        self.render_calendar()
        self.render_schedule_list()

    # ==================== 工具方法 ====================
    def get_app_dir(self):
        """获取程序运行目录（打包后也能正确找到 exe 所在文件夹）"""
        if getattr(sys, 'frozen', False):
            return os.path.dirname(sys.executable)
        return os.path.dirname(os.path.abspath(__file__))

    def _draw_rounded_rect(self, canvas, x1, y1, x2, y2, r, outline, width, fill):
        points = [
            x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r,
            x2, y2 - r, x2, y2, x2 - r, y2, x1 + r, y2,
            x1, y2, x1, y2 - r, x1, y1 + r, x1, y1,
        ]
        canvas.create_polygon(points, smooth=True, fill=fill, outline=outline, width=width)

    def create_rounded_button(self, parent, text, command, width, height, radius=8,
                              bg="#FFFFFF", fg="#E8956A", border="#E8956A", bw=2):
        canvas = tk.Canvas(parent, width=width, height=height,
                           bg=parent.cget("bg"), highlightthickness=0, cursor="hand2")
        self._draw_rounded_rect(canvas, 2, 2, width - 2, height - 2, radius, border, bw, bg)
        canvas.create_text(width / 2, height / 2, text=text, fill=fg, font=self.font_bold_small)

        canvas.bind("<Button-1>", lambda e: command())

        def on_enter(e):
            canvas.delete("all")
            self._draw_rounded_rect(canvas, 2, 2, width - 2, height - 2, radius, border, bw, self.colors['selected'])
            canvas.create_text(width / 2, height / 2, text=text, fill=fg, font=self.font_bold_small)

        def on_leave(e):
            canvas.delete("all")
            self._draw_rounded_rect(canvas, 2, 2, width - 2, height - 2, radius, border, bw, bg)
            canvas.create_text(width / 2, height / 2, text=text, fill=fg, font=self.font_bold_small)

        canvas.bind("<Enter>", on_enter)
        canvas.bind("<Leave>", on_leave)
        return canvas

    # ==================== 界面构建 ====================
    def setup_ui(self):
        main = tk.Frame(self.root, bg=self.colors['bg'])
        main.pack(fill='both', expand=True, padx=30, pady=30)

        header = tk.Frame(main, bg=self.colors['bg'])
        header.pack(fill='x', pady=(0, 25))

        brand = tk.Frame(header, bg=self.colors['bg'])
        brand.pack(side='left')
        tk.Label(brand, text="M0MoNa的日程", font=self.font_title,
                 bg=self.colors['bg'], fg=self.colors['text']).pack(anchor='w')
        tk.Label(brand, text="为什么要做的事永远做不完", font=("Microsoft YaHei UI", 10),
                 bg=self.colors['bg'], fg=self.colors['text_light']).pack(anchor='w', padx=3)

        nav = tk.Frame(header, bg=self.colors['bg'])
        nav.pack(side='right', pady=5)
        self.month_year_label = tk.Label(nav, text="", font=self.font_header,
                                         bg=self.colors['bg'], fg=self.colors['text'])
        self.month_year_label.pack(side='left', padx=20)

        self.create_rounded_button(nav, "<", self.prev_month, 40, 32).pack(side='left', padx=4)
        self.create_rounded_button(nav, "今天", self.go_today, 60, 32).pack(side='left', padx=4)
        self.create_rounded_button(nav, ">", self.next_month, 40, 32).pack(side='left', padx=4)

        body = tk.Frame(main, bg=self.colors['bg'])
        body.pack(fill='both', expand=True)

        # 左侧日历
        left_card = tk.Frame(body, bg=self.colors['card'], bd=0,
                             highlightbackground=self.colors['border'], highlightthickness=1)
        left_card.pack(side='left', fill='both', expand=True, padx=(0, 18))

        weekdays = ["一", "二", "三", "四", "五", "六", "日"]
        week_frame = tk.Frame(left_card, bg=self.colors['card'])
        week_frame.pack(fill='x', padx=25, pady=(25, 10))
        for i, day in enumerate(weekdays):
            fg = self.colors['weekend'] if i >= 5 else self.colors['text_light']
            tk.Label(week_frame, text=day, font=("Microsoft YaHei UI", 11, "bold"),
                     bg=self.colors['card'], fg=fg).pack(side='left', expand=True)

        self.calendar_grid = tk.Frame(left_card, bg=self.colors['card'])
        self.calendar_grid.pack(fill='both', expand=True, padx=25, pady=(0, 25))

        # 右侧日程
        right_card = tk.Frame(body, bg=self.colors['card'], bd=0,
                              highlightbackground=self.colors['border'], highlightthickness=1, width=380)
        right_card.pack(side='right', fill='both', padx=(18, 0))
        right_card.pack_propagate(False)

        self.date_header = tk.Label(right_card, text="", font=self.font_header,
                                    bg=self.colors['card'], fg=self.colors['text'])
        self.date_header.pack(anchor='w', padx=30, pady=(30, 5))

        sep = tk.Frame(right_card, bg=self.colors['border'], height=1)
        sep.pack(fill='x', padx=30, pady=12)

        list_wrap = tk.Frame(right_card, bg=self.colors['card'])
        list_wrap.pack(fill='both', expand=True, padx=30, pady=(0, 10))

        self.s_canvas = tk.Canvas(list_wrap, bg=self.colors['card'], highlightthickness=0)
        scrollbar = tk.Scrollbar(list_wrap, orient="vertical", command=self.s_canvas.yview,
                                 bg=self.colors['card'], troughcolor=self.colors['card'])
        self.s_frame = tk.Frame(self.s_canvas, bg=self.colors['card'])

        self.s_frame.bind("<Configure>",
                          lambda e: self.s_canvas.configure(scrollregion=self.s_canvas.bbox("all")))
        self.s_canvas.create_window((0, 0), window=self.s_frame, anchor='nw', width=310)
        self.s_canvas.configure(yscrollcommand=scrollbar.set)

        self.s_canvas.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        self.s_canvas.bind_all("<MouseWheel>", self.on_mousewheel)

        btn_area = tk.Frame(right_card, bg=self.colors['card'])
        btn_area.pack(fill='x', padx=30, pady=(5, 30))
        add_btn = self.create_rounded_button(btn_area, "+ 新建日程", self.add_schedule, 320, 40, radius=12)
        add_btn.pack(fill='x')

    # ==================== 日历逻辑 ====================
    def prev_month(self):
        y, m = self.view_date.year, self.view_date.month
        self.view_date = self.view_date.replace(year=y - 1, month=12) if m == 1 else self.view_date.replace(month=m - 1)
        self.render_calendar()

    def next_month(self):
        y, m = self.view_date.year, self.view_date.month
        self.view_date = self.view_date.replace(year=y + 1, month=1) if m == 12 else self.view_date.replace(month=m + 1)
        self.render_calendar()

    def go_today(self):
        self.view_date = self.today
        self.selected_date = self.today
        self.render_calendar()
        self.render_schedule_list()

    def render_calendar(self):
        for w in self.calendar_grid.winfo_children():
            w.destroy()

        y, m = self.view_date.year, self.view_date.month
        self.month_year_label.config(text=f"{y}年 {m}月")
        weeks = calendar.Calendar(firstweekday=0).monthdayscalendar(y, m)

        for week in weeks:
            row = tk.Frame(self.calendar_grid, bg=self.colors['card'])
            row.pack(fill='x', expand=True)
            for i, day in enumerate(week):
                cell = tk.Frame(row, bg=self.colors['card'], height=70)
                cell.pack(side='left', expand=True, fill='both', padx=2, pady=2)
                cell.pack_propagate(False)

                if day == 0:
                    tk.Label(cell, bg=self.colors['card']).pack(expand=True)
                    continue

                d = date(y, m, day)
                is_today = (d == self.today)
                is_sel = (d == self.selected_date)
                is_weekend = (i >= 5)
                has = self.day_has_unfinished(d)

                bg = self.colors['selected'] if is_sel else self.colors['card']
                cell.config(bg=bg)
                inner = tk.Frame(cell, bg=bg, width=50, height=50)
                inner.place(relx=0.5, rely=0.5, anchor='center')

                if is_today:
                    tk.Label(inner, text=str(day), font=("Microsoft YaHei UI", 12, "bold"),
                             bg=self.colors['primary'], fg='#FFFFFF', width=2, height=1
                             ).place(relx=0.5, rely=0.35, anchor='center')
                else:
                    num_fg = self.colors['weekend'] if (is_weekend and not is_sel) else self.colors['text']
                    weight = "bold" if is_sel else "normal"
                    tk.Label(inner, text=str(day), font=("Microsoft YaHei UI", 12, weight),
                             bg=bg, fg=num_fg).place(relx=0.5, rely=0.35, anchor='center')

                if has:
                    dot_color = '#FFFFFF' if is_today else self.colors['dot']
                    tk.Label(inner, text="●", font=("Microsoft YaHei UI", 5),
                             bg=bg, fg=dot_color).place(relx=0.5, rely=0.72, anchor='center')

                cell.bind("<Button-1>", lambda e, date=d: self.select_date(date))
                inner.bind("<Button-1>", lambda e, date=d: self.select_date(date))

    def select_date(self, d):
        self.selected_date = d
        self.render_calendar()
        self.render_schedule_list()

    def day_has_unfinished(self, d):
        """判断某天是否还有创建于该日且未完成的日程（用于红点提示）"""
        ds = str(d)
        return any(t.get("created") == ds and not t.get("completed", False)
                   for t in self.data.get("todos", []))

    # ==================== 日程列表（圆角边框 + 完成按钮） ====================
    def render_schedule_list(self):
        weekdays = ["一", "二", "三", "四", "五", "六", "日"]
        wd = weekdays[self.selected_date.weekday()]
        self.date_header.config(text=f"{self.selected_date.month}月{self.selected_date.day}日  星期{wd}")

        for w in self.s_frame.winfo_children():
            w.destroy()

        items = self.get_active_todos(self.selected_date)

        if not items:
            tk.Label(self.s_frame, text="暂无日程\n享受这片刻的宁静",
                     font=("Microsoft YaHei UI", 11), fg=self.colors['text_light'],
                     bg=self.colors['card'], justify='center').pack(pady=50)
            return

        items.sort(key=lambda x: x.get('created', ''))

        for item in items:
            card = tk.Canvas(self.s_frame, width=310, height=56,
                             bg=self.colors['card'], highlightthickness=0)
            card.pack(fill='x', pady=6)

            # 白色底 + 橙色圆角边框
            self._draw_rounded_rect(card, 1, 1, 309, 55, 10,
                                    self.colors['primary'], 2, self.colors['card'])

            # 日程内容（左侧）
            card.create_text(18, 28, text=item['content'],
                             font=("Microsoft YaHei UI", 10),
                             fill=self.colors['text'], anchor="w", width=200)

            # 删除按钮（×）
            card.create_text(248, 28, text="×",
                             font=("Microsoft YaHei UI", 14),
                             fill=self.colors['text_light'])

            # 完成按钮（右侧圆角小药丸 ✓）
            self._draw_rounded_rect(card, 268, 18, 302, 40, 8,
                                    self.colors['primary'], 2, self.colors['card'])
            card.create_text(285, 29, text="✓",
                             font=("Microsoft YaHei UI", 11, "bold"),
                             fill=self.colors['primary'])

            # 点击判定
            def make_handler(todo_id):
                def handler(e):
                    # 点击完成按钮区域
                    if 268 <= e.x <= 302 and 18 <= e.y <= 40:
                        self.complete_todo(todo_id)
                    # 点击删除区域
                    elif 238 <= e.x <= 258 and 10 <= e.y <= 46:
                        self.delete_todo(todo_id)
                return handler

            card.bind("<Button-1>", make_handler(item['id']))

    def get_active_todos(self, view_date):
        """
        核心逻辑：返回所有截止到 view_date 仍未完成的日程。
        这意味着今天没完成的任务，明天打开软件它还会出现在列表中，
        直到你点击右侧的「完成」按钮。
        """
        s = str(view_date)
        return [t for t in self.data.get("todos", [])
                if not t.get("completed", False) and t.get("created", "") <= s]

    def complete_todo(self, tid):
        """标记完成（从活跃列表消失，数据保留在已完成状态）"""
        for t in self.data.get("todos", []):
            if t.get("id") == tid:
                t["completed"] = True
                break
        self.save_data()
        self.render_calendar()
        self.render_schedule_list()

    def delete_todo(self, tid):
        """彻底删除"""
        self.data["todos"] = [t for t in self.data.get("todos", []) if t.get("id") != tid]
        self.save_data()
        self.render_calendar()
        self.render_schedule_list()

    # ==================== 添加日程（无时间） ====================
    def add_schedule(self):
        dlg = tk.Toplevel(self.root)
        dlg.title("新建日程")
        dlg.geometry("360x220")
        dlg.config(bg=self.colors['card'])
        dlg.transient(self.root)
        dlg.grab_set()

        rx, ry = self.root.winfo_x(), self.root.winfo_y()
        rw, rh = self.root.winfo_width(), self.root.winfo_height()
        dlg.geometry(f"+{rx + (rw - 360) // 2}+{ry + (rh - 220) // 2}")

        tk.Label(dlg, text="日程内容", font=self.font_normal,
                 bg=self.colors['card'], fg=self.colors['text']
                 ).pack(anchor='w', padx=28, pady=(30, 6))

        content_ent = tk.Entry(dlg, font=self.font_normal, bd=1, relief='solid',
                               highlightbackground=self.colors['border'],
                               highlightcolor=self.colors['primary'])
        content_ent.pack(fill='x', padx=28, ipady=6)
        content_ent.focus_set()

        def save():
            c = content_ent.get().strip()
            if not c:
                messagebox.showwarning("输入错误", "请输入日程内容", parent=dlg)
                return

            self.data.setdefault("todos", []).append({
                "id": str(uuid.uuid4())[:8],
                "content": c,
                "created": str(self.selected_date),
                "completed": False
            })
            self.save_data()
            self.render_calendar()
            self.render_schedule_list()
            dlg.destroy()

        btn_canvas = self.create_rounded_button(dlg, "保存", save, 120, 36, radius=10)
        btn_canvas.pack(pady=24)
        content_ent.bind("<Return>", lambda e: save())

    def on_mousewheel(self, event):
        self.s_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

    # ==================== 数据持久化 ====================
    def load_data(self):
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    raw = json.load(f)
                    if isinstance(raw, dict) and "todos" in raw:
                        return raw
                    # 兼容旧版按日期存储的格式
                    if isinstance(raw, dict):
                        todos = []
                        for d, items in raw.items():
                            for it in items:
                                if isinstance(it, dict):
                                    todos.append({
                                        "id": it.get("id", str(uuid.uuid4())[:8]),
                                        "content": it.get("content", ""),
                                        "created": d,
                                        "completed": False
                                    })
                        return {"todos": todos}
                    return {"todos": []}
            except Exception:
                return {"todos": []}
        return {"todos": []}

    def save_data(self):
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    root = tk.Tk()
    app = WarmScheduleApp(root)
    root.mainloop()