import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Bell,
  AlertTriangle,
  Repeat,
  Users,
  CheckCheck,
  Trash2,
  ExternalLink,
  Settings as SettingsIcon,
  Archive,
  RotateCcw,
  X,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useNotifications } from '../../hooks/useNotifications'
import { useTransactionModal } from '../../hooks/useTransactionModal'
import type { NotificationFilter, NotificationItem } from '../../lib/notifications'

export interface NotificationCenterModalProps {
  isOpen: boolean
  onClose: () => void
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate()
  const { openAdd } = useTransactionModal()
  const {
    notifications,
    unreadCount,
    archivedCount,
    filterNotifications,
    markAsRead,
    markAllAsRead,
    clearRead,
    archiveNotification,
    restoreFromArchive,
    deleteFromArchive,
    clearArchive,
    isRead,
  } = useNotifications()

  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all')

  const filteredItems = filterNotifications(activeFilter)

  const handleAction = (item: NotificationItem) => {
    markAsRead(item.id)
    if (item.id.startsWith('daily_reminder_')) {
      onClose()
      openAdd('expense')
      return
    }
    if (item.actionPath) {
      navigate(item.actionPath)
      onClose()
    }
  }

  const handleGoToSettings = () => {
    navigate('/settings')
    onClose()
  }

  const getCategoryIcon = (item: NotificationItem) => {
    if (item.isUrgent) {
      return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
    }
    switch (item.category) {
      case 'recurring':
        return <Repeat className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      case 'debt':
      case 'circle':
        return <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      case 'budget':
        return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
      case 'system':
      default:
        return <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      hideCloseButton={true}
      className="max-w-xl lg:max-w-2xl p-0 overflow-hidden rounded-3xl"
    >
      <div className="p-6 space-y-5 text-start">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold relative">
              <Bell className="w-5 h-5 stroke-[2.2]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -end-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                  {unreadCount > 99 ? '+99' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-50">
                مركز التنبيهات
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeFilter !== 'archived' && unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                title="تحديد الكل كمقروء"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">تحديد الكل</span>
              </button>
            )}
            {activeFilter !== 'archived' && notifications.some((n) => isRead(n.id)) && (
              <button
                type="button"
                onClick={clearRead}
                title="أرشفة المقروءة"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline">أرشفة المقروءة</span>
              </button>
            )}
            {activeFilter === 'archived' && archivedCount > 0 && (
              <button
                type="button"
                onClick={clearArchive}
                title="تفريغ الأرشيف"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">تفريغ الأرشيف</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleGoToSettings}
              title="إعدادات التنبيهات"
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          {[
            { id: 'all' as NotificationFilter, label: 'الكل', count: notifications.length },
            {
              id: 'urgent' as NotificationFilter,
              label: 'عاجل',
              count: notifications.filter((n) => n.isUrgent).length,
            },
            {
              id: 'unread' as NotificationFilter,
              label: 'غير مقروء',
              count: unreadCount,
            },
            {
              id: 'recurring' as NotificationFilter,
              label: 'المتكررة',
              count: notifications.filter((n) => n.category === 'recurring').length,
            },
            {
              id: 'debt_circle' as NotificationFilter,
              label: 'الديون والجمعيات',
              count: notifications.filter((n) => n.category === 'debt' || n.category === 'circle').length,
            },
            {
              id: 'archived' as NotificationFilter,
              label: 'الأرشيف',
              count: archivedCount,
            },
          ].map((tab) => {
            const isActive = activeFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive
                        ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Notification Items List */}
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto p-0.5">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 dark:text-zinc-500">
              {activeFilter === 'archived' ? (
                <>
                  <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">الأرشيف فارغ حالياً</p>
                </>
              ) : (
                <>
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">لا توجد تنبيهات حالياً في هذا القسم</p>
                </>
              )}
            </div>
          ) : (
            filteredItems.map((item) => {
              const read = isRead(item.id)
              return (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex items-start gap-3 ${
                    !read && activeFilter !== 'archived'
                      ? 'border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-zinc-900 shadow-2xs'
                      : 'border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 opacity-75'
                  }`}
                >
                  {/* Category / Urgency Icon */}
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                    {getCategoryIcon(item)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {item.title}
                        </h4>
                        {!read && activeFilter !== 'archived' && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                        {activeFilter === 'archived' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 shrink-0">
                            مؤرشف
                          </span>
                        )}
                      </div>

                      {/* Action buttons in header of card */}
                      <div className="flex items-center gap-1 shrink-0">
                        {activeFilter !== 'archived' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              archiveNotification(item.id)
                            }}
                            title="نقل إلى الأرشيف"
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                restoreFromArchive(item.id)
                              }}
                              title="استعادة من الأرشيف"
                              className="p-1 rounded-lg text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteFromArchive(item.id)
                              }}
                              title="حذف نهائي من الأرشيف"
                              className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                      {item.message}
                    </p>

                    {item.actionPath && (
                      <div className="mt-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAction(item)
                          }}
                          className="h-7 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-2 py-0"
                          icon={<ExternalLink className="w-3.5 h-3.5" />}
                        >
                          {item.actionLabel || 'عرض التفاصيل'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
