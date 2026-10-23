package com.joelcohen.withoutspoilers;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;

/** Pointer moved with the remote's D-pad. It only draws; the logic lives in MainActivity. */
public class CursorView extends View {
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path arrow = new Path();
    private float x, y;
    private final float size;

    public CursorView(Context c) {
        super(c);
        size = 22 * getResources().getDisplayMetrics().density;
        fill.setColor(0xFFFFFFFF);
        stroke.setColor(0xFF000000);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(2 * getResources().getDisplayMetrics().density);
        setFocusable(false);
        setClickable(false);
    }

    public void moveTo(float nx, float ny) {
        x = nx;
        y = ny;
        invalidate();
    }

    public float getCursorX() { return x; }
    public float getCursorY() { return y; }

    @Override
    protected void onDraw(Canvas canvas) {
        arrow.reset();
        arrow.moveTo(x, y);
        arrow.lineTo(x, y + size);
        arrow.lineTo(x + size * 0.28f, y + size * 0.74f);
        arrow.lineTo(x + size * 0.5f, y + size * 1.1f);
        arrow.lineTo(x + size * 0.64f, y + size * 1.02f);
        arrow.lineTo(x + size * 0.42f, y + size * 0.68f);
        arrow.lineTo(x + size * 0.75f, y + size * 0.68f);
        arrow.close();
        canvas.drawPath(arrow, fill);
        canvas.drawPath(arrow, stroke);
    }
}
