import React from 'react';
import { useTranslation } from 'react-i18next';
import InboundEmailLog from '../../components/EmailSecurity/InboundEmailLog';
import SafeLinkChecker from '../../components/EmailSecurity/SafeLinkChecker';

const EmailSecurity: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t('emailPage.title')}</h1>
      <p className="muted">{t('emailPage.subtitle')}</p>

      <div style={{ marginTop: 18 }}>
        <SafeLinkChecker />
      </div>

      <div style={{ marginTop: 18 }}>
        <InboundEmailLog />
      </div>
    </div>
  );
};

export default EmailSecurity;