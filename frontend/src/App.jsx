import {useEffect, useState} from 'react'
import {api} from './api.js'
import Transactions from './Transactions.jsx'
import CompteResultat from './CompteResultat.jsx'
import Reglages from './Reglages.jsx'
import TableauDeBord from './TableauDeBord.jsx'
import {useAuth} from './auth/AuthContext'

export default function App() {
    const [onglet, setOnglet] = useState('tableau')
    const [filtre, setFiltre] = useState('')
    const [mandats, setMandats] = useState([])
    const [mandatId, setMandatId] = useState(null)
    const [classeurs, setClasseurs] = useState([])
    const {user, logout} = useAuth();

    const chargerMandats = () => api('/mandats').then((m) => {
        setMandats(m);
        if (!mandatId && m.length) setMandatId(m[0].id)
    })
    const chargerClasseurs = () => mandatId && api('/classeurs?mandatId=' + mandatId).then(setClasseurs)

    // depuis le tableau de bord : ouvre les transactions avec le bon filtre
    const voir = (f) => {
        setFiltre(f)
        setOnglet('transactions')
    }

    useEffect(() => {
        chargerMandats()
    }, [])
    useEffect(() => {
        chargerClasseurs()
    }, [mandatId])

    return (
        <div className="page">
            <header className="no-print">

                <h1>Trésorerie</h1>
                <label>Mandat&nbsp;
                    <select value={mandatId ?? ''} onChange={(e) => setMandatId(Number(e.target.value))}>
                        {mandats.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                    </select>
                </label>
                <nav>
                    {[['tableau', 'Tableau de bord'], ['transactions', 'Transactions'], ['cr', 'Compte de résultat'], ['reglages', 'Réglages']].map(([k, l]) =>
                        <button key={k} className={onglet === k ? 'actif' : ''}
                                onClick={() => setOnglet(k)}>{l}</button>)}
                </nav>
                <div style={{marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center'}}>
                    <span>{user.displayName}</span>
                    <button onClick={logout}>Déconnexion</button>
                </div>
            </header>
            {mandatId && onglet === 'tableau' && <TableauDeBord mandatId={mandatId} onVoir={voir}/>}
            {mandatId && onglet === 'transactions' &&
                <Transactions mandatId={mandatId} classeurs={classeurs} filtre={filtre} setFiltre={setFiltre}/>}
            {mandatId && onglet === 'cr' && <CompteResultat mandatId={mandatId}/>}
            {onglet === 'reglages' && <Reglages mandats={mandats} mandatId={mandatId} classeurs={classeurs}
                                                onChange={() => {
                                                    chargerMandats();
                                                    chargerClasseurs()
                                                }}/>}
        </div>
    )
}
