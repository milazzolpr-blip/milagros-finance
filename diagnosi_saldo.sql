-- DIAGNOSI SALDO COMPLESSIVO F.A.M. (sola lettura, esegui nello SQL Editor di Supabase)
-- 1) Totali per tipo: confronta con l'app e con l'Excel
select tipo, count(*) as righe, round(sum(importo)::numeric,2) as totale
from transactions group by tipo order by tipo;

-- 2) Saldo complessivo corretto (entrate - uscite): deve coincidere con l'Excel dopo il fix
select round(sum(case when tipo='entrata' then importo when tipo='uscita' then -importo else 0 end)::numeric,2) as saldo_complessivo,
       count(*) as righe_totali
from transactions;

-- 3) Gruppi di righe con stesso date+created_at (causa dell'ordinamento instabile)
select date, created_at, count(*) as righe_con_pareggio
from transactions group by date, created_at having count(*)>1
order by righe_con_pareggio desc limit 20;

-- 4) Righe con tipo diverso da entrata/uscita (ignorate dal saldo)
select id, date, tipo, importo, voce from transactions where tipo not in ('entrata','uscita') limit 50;
