import { PurchaseBatchCard, type PackageOrder } from "./PurchaseBatchCard";

// ============================================================
// [PB] القائمة الموحّدة لبطاقات الشراء (2026-08-29)
//
// المبدأ الحاكم: شاشة واحدة لكل مرحلة، تعرض نوعين من البطاقات:
//   • بطاقة حزمة (تضم عدة طلبات)      → cardType: "package"
//   • بطاقة طلب مفرد (غير مجمّع)       → cardType: "order"
//
// لا توجد أي شاشة في التطبيق تعرض الحزم وحدها — أي قائمة تعرض حزمًا
// تعرض معها الطلبات المفردة (معيار القبول 12).
//
// هذا هو **الموضع الوحيد** بالعميل الذي يعرف منطق التجميع. الشاشات
// المضيفة تمرّر البيانات وتصيّر بطاقة الطلب المفرد بنفسها عبر
// renderOrderCard — فيبقى شكل الطلب المفرد مطابقًا لما هو عليه اليوم
// حرفيًا في كل شاشة، بلا توحيد قسري يغيّر مظهره (معيار القبول 9).
//
// النمط مطابق لـgetWarehouseTransferBatchCards المعتمد بالخادم: مفتاح
// مركّب `package:<id>` أو `po:<id>` يميّز نوع البطاقة.
// ============================================================

export interface PurchaseCardPackage {
  cardType: "package";
  key: string;
  id: number;
  packageNumber: string;
  createdById: number;
  createdAt: string | Date;
  orders: PackageOrder[];
}

export interface PurchaseCardOrder {
  cardType: "order";
  key: string;
  id: number;
  order: PackageOrder;
}

export type PurchaseCard = PurchaseCardPackage | PurchaseCardOrder;

export interface PurchaseCardListProps {
  cards: PurchaseCard[];
  /** تصيير بطاقة الطلب المفرد — تمرّره الشاشة المضيفة كما تعرضه اليوم */
  renderOrderCard: (order: PackageOrder) => React.ReactNode;
  /** فتح صفحة تفاصيل الحزمة */
  onOpenPackage?: (packageId: number) => void;
  /** فتح طلب من داخل حزمة */
  onOpenOrder?: (orderId: number) => void;
  /** أزرار إجراءات بطاقة الحزمة — تُمرَّر من الشاشة المضيفة */
  renderPackageActions?: (pkg: PurchaseCardPackage) => React.ReactNode;
  /** فتح قوائم الطلبات داخل الحزم افتراضيًا */
  expandPackagesByDefault?: boolean;
  locale?: string;
  emptyState?: React.ReactNode;
}

export function PurchaseCardList({
  cards,
  renderOrderCard,
  onOpenPackage,
  onOpenOrder,
  renderPackageActions,
  expandPackagesByDefault = false,
  locale = "ar",
  emptyState,
}: PurchaseCardListProps) {
  if (cards.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <div className="space-y-2">
      {cards.map((card) =>
        card.cardType === "package" ? (
          <PurchaseBatchCard
            key={card.key}
            packageNumber={card.packageNumber}
            createdAt={card.createdAt}
            orders={card.orders}
            onOpen={onOpenPackage ? () => onOpenPackage(card.id) : undefined}
            onOpenOrder={onOpenOrder}
            actions={renderPackageActions?.(card)}
            defaultExpanded={expandPackagesByDefault}
            locale={locale}
          />
        ) : (
          // الطلب المفرد يُصيَّر بمكوّن الشاشة المضيفة نفسه — بلا أي تغيير
          // في مظهره أو سلوكه عمّا هو عليه اليوم.
          <div key={card.key}>{renderOrderCard(card.order)}</div>
        )
      )}
    </div>
  );
}

export default PurchaseCardList;
