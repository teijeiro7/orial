package com.orial.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews
import com.orial.app.R
import org.json.JSONArray
import org.json.JSONObject

class OrialWidget : AppWidgetProvider() {
    
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }
    
    companion object {
        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = context.getSharedPreferences("orial_widget_data", Context.MODE_PRIVATE)
            val widgetData = prefs.getString("widget_data", null)
            
            val views = RemoteViews(context.packageName, R.layout.widget_orial)
            
            if (widgetData != null) {
                try {
                    val json = JSONObject(widgetData)
                    val completedCount = json.optInt("completedCount", 0)
                    val totalCount = json.optInt("totalCount", 0)
                    val streakCount = json.optInt("streakCount", 0)
                    
                    views.setTextViewText(R.id.widget_title, "Orial")
                    views.setTextViewText(R.id.widget_progress, "$completedCount/$totalCount")
                    views.setTextViewText(R.id.widget_subtitle, "Habits Done")
                    
                    if (streakCount > 0) {
                        views.setTextViewText(R.id.widget_streak, "🔥 $streakCount")
                        views.setViewVisibility(R.id.widget_streak, android.view.View.VISIBLE)
                    } else {
                        views.setViewVisibility(R.id.widget_streak, android.view.View.GONE)
                    }
                    
                    // Build habit emojis string
                    val habitsArray = json.optJSONArray("habits")
                    if (habitsArray != null && habitsArray.length() > 0) {
                        val emojis = StringBuilder()
                        for (i in 0 until minOf(habitsArray.length(), 5)) {
                            val habit = habitsArray.getJSONObject(i)
                            val emoji = habit.optString("emoji", "✅")
                            val completed = habit.optBoolean("completed", false)
                            
                            if (completed) {
                                emojis.append(emoji)
                            } else {
                                emojis.append("○")
                            }
                            emojis.append(" ")
                        }
                        views.setTextViewText(R.id.widget_habits, emojis.toString().trim())
                    }
                    
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
