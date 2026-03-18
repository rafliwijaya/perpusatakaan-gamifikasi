import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Search, Edit2, Trash2, BookOpen, X, Upload, MapPin, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import imgDev from '../../assets/img/dev.png';

export default function adminbooks() {

    return (
        <div>
        <img src={imgDev} alt="develop" style={{width:"20rem", height:"20rem"}} />
        <h3>Sabar ya.. fitur nya masih di kembangin :)</h3>
        </div>
    )
}