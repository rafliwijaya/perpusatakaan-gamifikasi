import {useState} from "react"
import {supabase} from "../lib/supabase"
import {useNavigate} from "react-router-dom"

export default function Register() {
    const navigate = useNavigate()

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [paswword, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleRegister = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const {data, error} = await supabase.auth.signUp ({
            
        })
    }
}