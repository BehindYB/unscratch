# UNSCRATCH — Lottery Odds & RTP Audit

Osservatorio statistico indipendente sulle probabilità reali, ritorno al giocatore (RTP), valore atteso e doppia erosione fiscale delle lotterie istantanee (Gratta e Vinci) attive in Italia.

> **Nota di Trasparenza:** Questo progetto ha finalità esclusivamente informative, matematiche e di data-journalism. Non promuoviamo né incoraggiamo in alcun modo il gioco d'azzardo. Tutti i dati provengono dai decreti direttoriali pubblici dell'**Agenzia delle Dogane e dei Monopoli (ADM)**.

## Metodologia di Calcolo

Per ciascun lotto iniziale di $L$ biglietti con prezzo unitario $P$ e fasce di premio $(V_i, N_i)$ (dove $V_i$ è l'importo lordo del premio e $N_i$ il numero di biglietti vincenti di quella fascia):

1. **Tassazione ("Tassa sulla Fortuna" - Legge n. 160/2019, Art. 1 comma 734):**
   - I premi fino a $500,00\text{ €}$ sono esenti da trattenuta alla fonte.
   - Sulla parte di vincita eccedente $500,00\text{ €}$ viene applicata una ritenuta a titolo d'imposta del **20%**:
     $$T_i = \max(0,\; (V_i - 500) \times 0,20), \qquad V_{i,\text{netto}} = V_i - T_i$$

2. **Scorporo Pareggio vs Guadagno Reale (D.L. n. 87/2018, Art. 9 comma 1-ter):**
   - Le tabelle ufficiali omettono l'indicazione della probabilità dei premi pari al costo della giocata ($V_i = P$).
   - **Unscratch** scorpora esplicitamente il lotto in tre categorie disgiunte:
     - **Perdita secca ($0\text{ €}$):** $L - \sum N_i$
     - **Pareggio ($V_i = P$):** recupero della sola spesa, utile netto $0\text{ €}$
     - **Guadagno reale ($V_i > P$):** vincita superiore al costo del biglietto

3. **Return to Player (RTP) e Perdita Attesa per Biglietto:**
   $$\text{RTP}_{\text{lordo}} = \frac{\sum (V_i \cdot N_i)}{L \cdot P}, \qquad \text{RTP}_{\text{netto}} = \frac{\sum (V_{i,\text{netto}} \cdot N_i)}{L \cdot P}$$
   $$\text{Perdita Media Netta} = P - \frac{\sum (V_{i,\text{netto}} \cdot N_i)}{L}$$

## Aggiornamento Dati

Lo script `scraper_catalogo.py` interroga le tabelle ufficiali ADM e viene eseguito automaticamente ogni settimana tramite GitHub Actions (`.github/workflows/update_catalog.yml`).
