const fs = require('fs');
let code = fs.readFileSync('src/components/obligations/obligations-page.tsx', 'utf8');

// Imports
if (!code.includes('import { PaymentModal }')) {
  code = code.replace("import { TimeNavigator } from \"@/components/layout/time-navigator\";", "import { TimeNavigator } from \"@/components/layout/time-navigator\";\nimport { PaymentModal } from './payment-modal';");
}

// State
if (!code.includes('paymentObligation')) {
  code = code.replace("const [deleteId, setDeleteId] = useState<string | null>(null);", "const [deleteId, setDeleteId] = useState<string | null>(null);\n  const [paymentObligation, setPaymentObligation] = useState<Obligation | null>(null);\n  const expenses = useStore((state) => state.expenses);");
}

// togglePaidStatus
const getStatusFunc = `
  const getObligationRemaining = (o: Obligation) => {
    if (o.status === 'paid' || o.status === 'cancelled') return 0;
    if (o.isPaid && !o.status) return 0;
    const paid = expenses
      .filter(e => e.obligationId === o.id && e.status !== 'reverted')
      .reduce((sum, e) => sum + e.amount, 0);
    return Math.max(0, o.amount - paid);
  };
  const getObligationPaidAmount = (o: Obligation) => {
    return expenses
      .filter(e => e.obligationId === o.id && e.status !== 'reverted')
      .reduce((sum, e) => sum + e.amount, 0);
  };
`;
code = code.replace("const deleteExpense = deleteObligation; // alias for clarity", "const deleteExpense = deleteObligation; // alias for clarity\n" + getStatusFunc);

// Render item
const renderRegex = /<button[\s\S]*?onClick=\{\(\) => togglePaidStatus\(obligation\)\}[\s\S]*?<\/button>/;
const newButton = `
                  <Button
                    onClick={() => setPaymentObligation(obligation)}
                    variant={getObligationRemaining(obligation) <= 0 ? 'ghost' : 'primary'}
                    size="sm"
                    className="shrink-0"
                  >
                    {getObligationRemaining(obligation) <= 0 ? <Check className="w-4 h-4 text-emerald-500" /> : 'Registrar pago'}
                  </Button>
`;
code = code.replace(renderRegex, newButton);

const amountRegex = /<p[\s\S]*?formatCurrency\(obligation\.amount[\s\S]*?<\/p>/;
const newAmount = `
                    <div className="flex flex-col items-end">
                      <p className={\`font-semibold \${getObligationRemaining(obligation) <= 0 ? 'text-surface-400 line-through' : 'text-surface-900 dark:text-white'}\`}>
                        {formatCurrency(obligation.amount, profile?.currency)}
                      </p>
                      {getObligationPaidAmount(obligation) > 0 && getObligationRemaining(obligation) > 0 && (
                        <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                          Pagado: {formatCurrency(getObligationPaidAmount(obligation), profile?.currency)}
                        </p>
                      )}
                    </div>
`;
code = code.replace(amountRegex, newAmount);

const statusBadgeRegex = /<StatusBadge[\s\S]*?context="obligation"[\s\S]*?\/>/;
const newStatusBadge = `
                      <StatusBadge
                        status={
                          obligation.status === 'overdue' ? 'overdue' :
                          obligation.status === 'cancelled' ? 'cancelled' :
                          getObligationRemaining(obligation) <= 0 ? 'confirmed' : 
                          getObligationPaidAmount(obligation) > 0 ? 'partial' : 'pending'
                        }
                        context="obligation"
                        size="xs"
                      />
`;
code = code.replace(statusBadgeRegex, newStatusBadge);

// Modal
const modalRegex = /<ConfirmDialog[\s\S]*?isOpen=\{\!\!deleteId\}[\s\S]*?\/>/;
const modals = `
      <PaymentModal
        isOpen={!!paymentObligation}
        onClose={() => setPaymentObligation(null)}
        obligation={paymentObligation}
      />
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar Obligación"
        description="¿Estás seguro de que deseas eliminar esta obligación? Esta acción no se puede deshacer."
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
`;
code = code.replace(modalRegex, modals);

fs.writeFileSync('src/components/obligations/obligations-page.tsx', code);
