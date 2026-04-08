// JARVIS Coder Skills Library
// Pre-built, tested code templates — no generation needed for common tasks

const SKILLS = {

  // ── WEB / HTML ────────────────────────────────────────────────────
  html_page: (title, bodyContent) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0f0f0f; color: #e0e0e0; min-height: 100vh;
         display: flex; flex-direction: column; align-items: center;
         justify-content: center; padding: 2rem; }
  h1 { font-size: 2rem; margin-bottom: 1rem; color: #fff; }
  .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
          padding: 2rem; max-width: 600px; width: 100%; }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`,

  // ── PYTHON TIMER ──────────────────────────────────────────────────
  python_timer: () => `import tkinter as tk
import time

class Timer:
    def __init__(self, root):
        self.root = root
        self.root.title("Timer")
        self.root.configure(bg='#1a1a1a')
        self.running = False
        self.start_time = 0
        self.elapsed = 0
        self.label = tk.Label(root, text="00:00:00", font=("Helvetica", 48, "bold"),
                              bg='#1a1a1a', fg='#00ff88')
        self.label.pack(pady=20, padx=40)
        btn_frame = tk.Frame(root, bg='#1a1a1a')
        btn_frame.pack(pady=10)
        tk.Button(btn_frame, text="Start", command=self.start, bg='#00ff88',
                  fg='#000', font=("Helvetica", 14, "bold"), padx=20).pack(side=tk.LEFT, padx=5)
        tk.Button(btn_frame, text="Stop", command=self.stop, bg='#ff4444',
                  fg='#fff', font=("Helvetica", 14, "bold"), padx=20).pack(side=tk.LEFT, padx=5)
        tk.Button(btn_frame, text="Reset", command=self.reset, bg='#555',
                  fg='#fff', font=("Helvetica", 14, "bold"), padx=20).pack(side=tk.LEFT, padx=5)
    def start(self):
        if not self.running:
            self.running = True
            self.start_time = time.time() - self.elapsed
            self.update()
    def stop(self): self.running = False
    def reset(self):
        self.running = False
        self.elapsed = 0
        self.label.config(text="00:00:00")
    def update(self):
        if self.running:
            self.elapsed = time.time() - self.start_time
            h = int(self.elapsed // 3600)
            m = int((self.elapsed % 3600) // 60)
            s = int(self.elapsed % 60)
            self.label.config(text=f"{h:02d}:{m:02d}:{s:02d}")
            self.root.after(100, self.update)

root = tk.Tk()
Timer(root)
root.mainloop()`,

  // ── PYTHON CALCULATOR ─────────────────────────────────────────────
  python_calc: () => `import tkinter as tk

class Calc:
    def __init__(self, root):
        root.title("Calculator"); root.configure(bg='#1c1c1c'); root.resizable(False,False)
        self.expr = ''
        self.disp = tk.StringVar(value='0')
        tk.Entry(root, textvariable=self.disp, font=("Helvetica",24), bg='#2a2a2a',
                 fg='white', bd=0, justify='right', state='readonly').grid(row=0,column=0,columnspan=4,padx=10,pady=10,sticky='ew')
        btns = [['C','±','%','÷'],['7','8','9','×'],['4','5','6','−'],['1','2','3','+'],['0','.','⌫','=']]
        for r,row in enumerate(btns):
            for c,b in enumerate(row):
                bg = '#ff9f0a' if b in '=÷×−+' else '#505050' if b in 'C±%' else '#2a2a2a'
                tk.Button(root, text=b, font=("Helvetica",18), bg=bg, fg='white',
                          activebackground='#888', bd=0, padx=20, pady=15,
                          command=lambda x=b: self.press(x)).grid(row=r+1,column=c,padx=2,pady=2)
    def press(self, k):
        if k=='C': self.expr=''; self.disp.set('0')
        elif k=='=':
            try:
                r=eval(self.expr.replace('÷','/').replace('×','*').replace('−','-'))
                self.disp.set(str(round(r,10)).rstrip('0').rstrip('.'))
                self.expr=str(r)
            except: self.disp.set('Error'); self.expr=''
        elif k=='⌫': self.expr=self.expr[:-1]; self.disp.set(self.expr or '0')
        elif k=='±': self.expr=str(-float(self.expr)) if self.expr else '0'; self.disp.set(self.expr)
        elif k=='%': self.expr=str(float(self.expr)/100) if self.expr else '0'; self.disp.set(self.expr)
        else: self.expr+=k; self.disp.set(self.expr)

root=tk.Tk(); Calc(root); root.mainloop()`,

  // ── PYTHON CLOCK ─────────────────────────────────────────────────
  python_clock: () => `import tkinter as tk
import time

root = tk.Tk(); root.title("Clock"); root.configure(bg='#0a0a0a')
label = tk.Label(root, font=("Helvetica",64,"bold"), bg='#0a0a0a', fg='#00ff88')
label.pack(pady=30, padx=60)
date_label = tk.Label(root, font=("Helvetica",16), bg='#0a0a0a', fg='#888')
date_label.pack()
def tick():
    t = time.localtime()
    label.config(text=time.strftime('%H:%M:%S', t))
    date_label.config(text=time.strftime('%A, %B %d %Y', t))
    root.after(1000, tick)
tick(); root.mainloop()`,

  // ── PYTHON TODO ───────────────────────────────────────────────────
  python_todo: () => `import tkinter as tk
from tkinter import messagebox

class TodoApp:
    def __init__(self, root):
        root.title("Todo"); root.configure(bg='#1a1a1a'); root.geometry('400x500')
        top = tk.Frame(root, bg='#1a1a1a'); top.pack(fill=tk.X, padx=15, pady=15)
        self.entry = tk.Entry(top, font=("Helvetica",14), bg='#2a2a2a', fg='white',
                              insertbackground='white', bd=0)
        self.entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,10), ipady=8)
        self.entry.bind('<Return>', self.add)
        tk.Button(top, text='+', font=("Helvetica",14,"bold"), bg='#00ff88', fg='#000',
                  bd=0, padx=12, command=self.add).pack(side=tk.RIGHT)
        frame = tk.Frame(root, bg='#1a1a1a'); frame.pack(fill=tk.BOTH, expand=True, padx=15)
        self.lb = tk.Listbox(frame, font=("Helvetica",13), bg='#2a2a2a', fg='white',
                             selectbackground='#00ff88', selectforeground='#000',
                             bd=0, activestyle='none')
        self.lb.pack(fill=tk.BOTH, expand=True)
        tk.Button(root, text='Delete Selected', bg='#ff4444', fg='white', font=("Helvetica",12),
                  bd=0, pady=8, command=self.delete).pack(fill=tk.X, padx=15, pady=15)
    def add(self, *_):
        t = self.entry.get().strip()
        if t: self.lb.insert(tk.END, '  ☐  '+t); self.entry.delete(0, tk.END)
    def delete(self):
        if self.lb.curselection(): self.lb.delete(self.lb.curselection())

root=tk.Tk(); TodoApp(root); root.mainloop()`,

};

// ── Smart task matcher ────────────────────────────────────────────
function matchSkill(task) {
  const t = task.toLowerCase();
  if (/\btimer\b|\bstopwatch\b/.test(t))      return { code: SKILLS.python_timer(),      ext:'py', gui:true,  name:'timer' };
  if (/\bcalculator\b|\bcalc\b/.test(t))      return { code: SKILLS.python_calc(),       ext:'py', gui:true,  name:'calc' };
  if (/\bclock\b|\btime.*display\b/.test(t))  return { code: SKILLS.python_clock(),      ext:'py', gui:true,  name:'clock' };
  if (/\btodo\b|\bto.do\b|\btask.*list\b/.test(t)) return { code: SKILLS.python_todo(), ext:'py', gui:true,  name:'todo' };
  return null;
}

module.exports = { SKILLS, matchSkill };
