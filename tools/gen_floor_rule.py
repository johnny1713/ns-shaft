"""Prints the floor .validate expression for database.rules.json.
Rerun whenever the scroll speed curve in game.js changes."""
import json, sys
# Simulate the camera exactly like game.js to get T(F): seconds until floor F is reached
dt=1/240; cam=0; t=0; F=1; T={1:0.0}
while F<131:
    lvl=min(12,F//10); s=105+lvl*14+(F%10)*0.8; cam+=s*dt; t+=dt
    nf=1+int(cam//420)
    if nf>F: F=nf; T[F]=t
# A run that ends on floor F lasted between T(F) and T(F+1). Per decade, fit linear bounds in ms.
segs=[]
for d in range(0,12):
    a=max(1,d*10); b=d*10+9
    lo_a,lo_b=T[a],T[b]; hi_a,hi_b=T[a+1],T[b+1]
    slo=(lo_b-lo_a)/(b-a) if b>a else 0; shi=(hi_b-hi_a)/(b-a) if b>a else 0
    # check linear fit error
    err=max(max(abs(lo_a+slo*(f-a)-T[f]),abs(hi_a+shi*(f-a)-T[f+1])) for f in range(a,b+1))
    tol=2.0+err
    lo=f"({lo_a-tol:.2f} + (newData.val() - {a}) * {slo:.4f}) * 1000"
    hi=f"({hi_a+tol:.2f} + (newData.val() - {a}) * {shi:.4f}) * 1000"
    segs.append(f"(newData.val() >= {a} && newData.val() <= {b} && t >= {lo} && t <= {hi})")
# Beyond floor 120 the speed only wobbles by floor % 10, so one line covers it
a=120; s=(T[130]-T[120])/10
segs.append(f"(newData.val() >= 120 && t >= ({T[120]*0.99-3:.2f} + (newData.val() - 120) * {s*0.99:.4f}) * 1000 && t <= ({T[121]*1.01+3:.2f} + (newData.val() - 120) * {s*1.01:.4f}) * 1000)")
expr=" || ".join(segs).replace("t >=","newData.parent().child('timeMs').val() >=").replace("t <=","newData.parent().child('timeMs').val() <=")
print(expr)
